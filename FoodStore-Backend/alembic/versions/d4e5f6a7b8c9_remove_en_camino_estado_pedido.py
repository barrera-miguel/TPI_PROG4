"""remove EN_CAMINO from estado_pedido (FSM v7 has 5 states)

Revision ID: d4e5f6a7b8c9
Revises: cc122d35b334
Create Date: 2026-06-09 00:00:00.000000

"""
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "cc122d35b334"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM estado_pedido WHERE codigo = 'EN_CAMINO'")


def downgrade() -> None:
    op.execute(
        "INSERT INTO estado_pedido (codigo, descripcion, orden, es_terminal) "
        "VALUES ('EN_CAMINO', 'Enviado al cliente', 4, false) "
        "ON CONFLICT (codigo) DO NOTHING"
    )
