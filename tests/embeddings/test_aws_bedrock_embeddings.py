import json
from unittest.mock import Mock, patch

import pytest

from mem0.configs.embeddings.base import BaseEmbedderConfig
from mem0.embeddings.aws_bedrock import AWSBedrockEmbedding


@pytest.fixture
def mock_boto3_client():
    with patch("mem0.embeddings.aws_bedrock.boto3.client") as mock_client:
        mock_client.return_value = Mock()
        yield mock_client


def test_session_token_from_config_is_passed_to_client(mock_boto3_client):
    """A session token supplied via config must reach the bedrock-runtime client.

    Temporary credentials (STS / assume-role) require a session token; the LLM
    Bedrock provider already honors it, so the embedding provider should too.
    """
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(
            model="amazon.titan-embed-text-v2:0",
            aws_access_key_id="AKIA_TEST",
            aws_secret_access_key="SECRET_TEST",
            aws_session_token="SESSION_TOKEN_TEST",
            aws_region="eu-central-1",
        )
        AWSBedrockEmbedding(config)

    _, kwargs = mock_boto3_client.call_args
    assert kwargs["aws_session_token"] == "SESSION_TOKEN_TEST"
    assert kwargs["aws_access_key_id"] == "AKIA_TEST"
    assert kwargs["aws_secret_access_key"] == "SECRET_TEST"
    assert kwargs["region_name"] == "eu-central-1"


def test_session_token_falls_back_to_env(mock_boto3_client):
    """When config doesn't set a session token, the env var is still used."""
    with patch.dict(
        "mem0.embeddings.aws_bedrock.os.environ",
        {"AWS_SESSION_TOKEN": "ENV_SESSION_TOKEN"},
        clear=True,
    ):
        config = BaseEmbedderConfig(model="amazon.titan-embed-text-v2:0")
        AWSBedrockEmbedding(config)

    _, kwargs = mock_boto3_client.call_args
    assert kwargs["aws_session_token"] == "ENV_SESSION_TOKEN"


def test_no_session_token_passes_none(mock_boto3_client):
    """Without a token in config or env, the client receives None (unchanged)."""
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(model="amazon.titan-embed-text-v2:0")
        AWSBedrockEmbedding(config)

    _, kwargs = mock_boto3_client.call_args
    assert kwargs["aws_session_token"] is None


def _captured_request_body(mock_boto3_client, config, memory_action=None):
    """Run a single embed call and return the JSON body sent to invoke_model."""
    runtime = mock_boto3_client.return_value
    response_stream = Mock()
    response = (
        {"embeddings": [[0.0, 0.1, 0.2]]}
        if config.model.startswith("cohere.")
        else {"embedding": [0.0, 0.1, 0.2]}
    )
    response_stream.read.return_value = json.dumps(response).encode()
    runtime.invoke_model.return_value = {"body": response_stream}

    embedder = AWSBedrockEmbedding(config)
    embedder.embed("hello world", memory_action)

    _, call_kwargs = runtime.invoke_model.call_args
    return json.loads(call_kwargs["body"])


def test_titan_v2_forwards_embedding_dims_as_dimensions(mock_boto3_client):
    """Titan Text Embeddings V2 must receive embedding_dims as `dimensions`.

    Titan V2 supports an optional output size (256/512/1024); without forwarding
    it the model returns its default 1024-d vector and ignores the user's request.
    """
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(model="amazon.titan-embed-text-v2:0", embedding_dims=512)
        body = _captured_request_body(mock_boto3_client, config)

    assert body["dimensions"] == 512
    assert body["inputText"] == "hello world"


def test_titan_v2_without_embedding_dims_omits_dimensions(mock_boto3_client):
    """When embedding_dims is unset, no `dimensions` key is sent (model default)."""
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(model="amazon.titan-embed-text-v2:0")
        body = _captured_request_body(mock_boto3_client, config)

    assert "dimensions" not in body


def test_titan_v1_ignores_embedding_dims(mock_boto3_client):
    """Titan V1 has no configurable output size, so `dimensions` must not be sent."""
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(model="amazon.titan-embed-text-v1", embedding_dims=512)
        body = _captured_request_body(mock_boto3_client, config)

    assert "dimensions" not in body


def test_cohere_embed_v4_uses_document_input_for_stored_memories(mock_boto3_client):
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(model="cohere.embed-v4:0", embedding_dims=1536)
        body = _captured_request_body(mock_boto3_client, config, "add")

    assert body == {
        "input_type": "search_document",
        "texts": ["hello world"],
        "embedding_types": ["float"],
        "output_dimension": 1536,
    }


def test_cohere_embed_v4_uses_query_input_for_search(mock_boto3_client):
    with patch("mem0.embeddings.aws_bedrock.os.environ", {}):
        config = BaseEmbedderConfig(model="cohere.embed-v4:0")
        body = _captured_request_body(mock_boto3_client, config, "search")

    assert body == {
        "input_type": "search_query",
        "texts": ["hello world"],
        "embedding_types": ["float"],
    }


def test_cohere_embed_v4_parses_typed_float_response(mock_boto3_client):
    runtime = mock_boto3_client.return_value
    response_stream = Mock()
    response_stream.read.return_value = json.dumps(
        {"embeddings": {"float": [[0.1, 0.2, 0.3]]}, "response_type": "embeddings_by_type"}
    ).encode()
    runtime.invoke_model.return_value = {"body": response_stream}
    config = BaseEmbedderConfig(model="cohere.embed-v4:0")

    result = AWSBedrockEmbedding(config).embed("hello world", "search")

    assert result == [0.1, 0.2, 0.3]
