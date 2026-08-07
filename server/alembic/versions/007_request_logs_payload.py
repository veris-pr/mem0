"""Add entity ids and payload snapshots to request_logs

Revision ID: 007
Revises: 006
Create Date: 2026-07-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("request_logs", sa.Column("user_id", sa.String(length=255), nullable=True))
    op.add_column("request_logs", sa.Column("agent_id", sa.String(length=255), nullable=True))
    op.add_column("request_logs", sa.Column("run_id", sa.String(length=255), nullable=True))
    op.add_column("request_logs", sa.Column("app_id", sa.String(length=255), nullable=True))
    op.add_column("request_logs", sa.Column("request_body", sa.Text(), nullable=True))
    op.add_column("request_logs", sa.Column("response_body", sa.Text(), nullable=True))
    op.create_index("ix_request_logs_user_id", "request_logs", ["user_id"])
    op.create_index("ix_request_logs_agent_id", "request_logs", ["agent_id"])
    op.create_index("ix_request_logs_run_id", "request_logs", ["run_id"])
    op.create_index("ix_request_logs_app_id", "request_logs", ["app_id"])


def downgrade() -> None:
    op.drop_index("ix_request_logs_app_id", table_name="request_logs")
    op.drop_index("ix_request_logs_run_id", table_name="request_logs")
    op.drop_index("ix_request_logs_agent_id", table_name="request_logs")
    op.drop_index("ix_request_logs_user_id", table_name="request_logs")
    op.drop_column("request_logs", "response_body")
    op.drop_column("request_logs", "request_body")
    op.drop_column("request_logs", "app_id")
    op.drop_column("request_logs", "run_id")
    op.drop_column("request_logs", "agent_id")
    op.drop_column("request_logs", "user_id")
