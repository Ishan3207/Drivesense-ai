"""Initial migration for DriveSense AI – creates all core tables.

Revision ID: 0001
Revises: –
Create Date: 2026-03-22
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── vehicles ───────────────────────────────────────────────────────────────
    op.create_table(
        "vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("make", sa.String(64), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("vin", sa.String(17), nullable=True, unique=True),
        sa.Column("nickname", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )

    # ── dtc_logs ───────────────────────────────────────────────────────────────
    op.create_table(
        "dtc_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vehicle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vehicles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("code", sa.String(8), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("llm_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("severity", sa.String(16), nullable=False, server_default="unknown"),
        sa.Column("resolved", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("detected_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_dtc_logs_code", "dtc_logs", ["code"])
    op.create_index("ix_dtc_logs_resolved", "dtc_logs", ["resolved"])

    # ── driver_scores ──────────────────────────────────────────────────────────
    op.create_table(
        "driver_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vehicle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vehicles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("score", sa.Float, nullable=False, server_default="100.0"),
        sa.Column("delta", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("reason", sa.String(256), nullable=True),
        sa.Column("recorded_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_driver_scores_recorded_at", "driver_scores", ["recorded_at"])

    # ── geofences ──────────────────────────────────────────────────────────────
    op.create_table(
        "geofences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("zone_type", sa.String(32), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("radius_meters", sa.Float, nullable=False, server_default="300.0"),
        sa.Column("speed_limit_kmh", sa.Float, nullable=False, server_default="25.0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_geofences_zone_type", "geofences", ["zone_type"])
    op.create_index("ix_geofences_active", "geofences", ["active"])


def downgrade() -> None:
    op.drop_table("geofences")
    op.drop_table("driver_scores")
    op.drop_table("dtc_logs")
    op.drop_table("vehicles")
