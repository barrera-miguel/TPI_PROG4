import logging
import sys

from app.core.config import configuracion


def setup_logging(level_name: str | None = None) -> None:
    """
    Configura el sistema de logging de la aplicación.

    Idempotente: se puede llamar varias veces sin duplicar handlers.
    """
    if level_name is None:
        level_name = getattr(configuracion, "LOG_LEVEL", "INFO")
    level: int = getattr(logging, level_name)

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    app_logger = logging.getLogger("app")
    app_logger.setLevel(level)
    app_logger.handlers.clear()
    app_logger.addHandler(handler)
    app_logger.propagate = False

    # El logger del middleware tiene handler propio (no depende de app)
    # pero fileConfig() de alembic lo desactiva. Lo reactivamos acá.
    mw_logger = logging.getLogger("app.middleware.logging")
    mw_logger.disabled = False
    mw_logger.setLevel(level)
    if not mw_logger.handlers:
        mw_logger.addHandler(handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Atajo para crear loggers hijos del logger 'app'."""
    return logging.getLogger(name)
