"""Servisler icin ortak loglama yapilandirmasi."""

import logging
import sys

from config import LOG_LEVEL

LOG_FORMAT = "%(asctime)s %(levelname)-7s [%(name)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
ROOT_LOGGER_NAME = "zenith"


def setup_logging():
    """`zenith.*` logger'larini stdout'a yazacak sekilde bir kez yapilandirir."""
    logger = logging.getLogger(ROOT_LOGGER_NAME)
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, LOG_DATE_FORMAT))

    level = logging.getLevelName(LOG_LEVEL)
    logger.setLevel(level if isinstance(level, int) else logging.INFO)
    logger.addHandler(handler)
    logger.propagate = False
    return logger
