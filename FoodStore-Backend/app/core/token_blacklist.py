_revoked_jtis: set[str] = set()


def revocar_jti(jti: str) -> None:
    _revoked_jtis.add(jti)


def esta_revocado(jti: str) -> bool:
    return jti in _revoked_jtis
