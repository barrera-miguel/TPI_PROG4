from decimal import Decimal

from app.core.security import hashear_contrasena
from app.models.estado_pedido import EstadoPedido
from app.models.forma_pago import FormaPago
from app.models.ingrediente import Ingrediente
from app.models.rol import Rol
from app.models.unidad_medida import UnidadMedida
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.schemas.categoria import CategoriaCreate
from app.schemas.ingrediente import IngredienteCreate
from app.schemas.producto import CategoriaAsignacion, IngredienteAsignacion, ProductoCreate
from app.uow.uow import UnidadDeTrabajo

ROLES_INICIALES = [
    Rol(codigo="ADMIN",   nombre="Administrador",  descripcion="Acceso total sin restricciones"),
    Rol(codigo="STOCK",   nombre="Encargado Stock", descripcion="Actualiza stock y disponible"),
    Rol(codigo="PEDIDOS", nombre="Gestor Pedidos",  descripcion="Avanza estados CONFIRMADO → ENTREGADO"),
    Rol(codigo="CLIENT",  nombre="Cliente",         descripcion="Opera solo sus propios datos"),
]

ESTADOS_PEDIDO_INICIALES = [
    EstadoPedido(codigo="PENDIENTE",      descripcion="Pedido recibido, pendiente de confirmación", orden=1, es_terminal=False),
    EstadoPedido(codigo="CONFIRMADO",     descripcion="Pedido confirmado, en preparación pendiente", orden=2, es_terminal=False),
    EstadoPedido(codigo="EN_PREPARACION", descripcion="En preparación",                              orden=3, es_terminal=False),
    EstadoPedido(codigo="ENTREGADO",      descripcion="Entregado al cliente",                        orden=4, es_terminal=True),
    EstadoPedido(codigo="CANCELADO",      descripcion="Cancelado",                                   orden=5, es_terminal=True),
]

FORMAS_PAGO_INICIALES = [
    FormaPago(codigo="MERCADOPAGO",   descripcion="Checkout API MercadoPago",  habilitado=True),
    FormaPago(codigo="EFECTIVO",      descripcion="Pago en efectivo (pickup)", habilitado=True),
    FormaPago(codigo="TRANSFERENCIA", descripcion="Transferencia bancaria",    habilitado=True),
]

UNIDADES_INICIALES = [
    UnidadMedida(nombre="kilogramo",      simbolo="kg",  tipo="masa"),
    UnidadMedida(nombre="gramo",          simbolo="g",   tipo="masa"),
    UnidadMedida(nombre="litro",          simbolo="L",   tipo="volumen"),
    UnidadMedida(nombre="mililitro",      simbolo="mL",  tipo="volumen"),
    UnidadMedida(nombre="pieza",          simbolo="u",       tipo="unidad"),
    UnidadMedida(nombre="docena",         simbolo="doc",     tipo="unidad"),
    UnidadMedida(nombre="metro cuadrado", simbolo="m²",      tipo="área"),
    UnidadMedida(nombre="porciones",      simbolo="porciones", tipo="contable"),
]

ADMIN_EMAIL = "admin@foodstore.com"
ADMIN_PASSWORD = "Admin1234!"


# ── Seed helpers ──────────────────────────────────────────────────────────────

def _seed_categorias(uow) -> dict[str, int]:
    existentes = {c.nombre: c.id for c in uow.categorias.obtener_todos(limit=100)}
    datos = [
        ("Hamburguesas", "Hamburguesas artesanales"),
        ("Bebidas",      "Bebidas frías y calientes"),
        ("Postres",      "Postres y dulces"),
        ("Ensaladas",    "Ensaladas frescas"),
        ("Sandwiches",   "Sandwiches y wraps"),
    ]
    for nombre, descripcion in datos:
        if nombre not in existentes:
            nueva = uow.categorias.crear(CategoriaCreate(nombre=nombre, descripcion=descripcion))
            existentes[nombre] = nueva.id
    return existentes


def _seed_ingredientes(uow) -> dict[str, Ingrediente]:
    todas_um = uow.unidades_medida.obtener_todos(limit=50)
    um = {u.simbolo: u.id for u in todas_um}

    existentes = {i.nombre: i for i in uow.ingredientes.obtener_todos(limit=200)}

    datos = [
        # (nombre,              simbolo, stock,              precio_costo,       alergeno)
        ("Pan brioche",      "u",  Decimal("200"),   Decimal("250.00"), True),
        ("Pan integral",     "u",  Decimal("150"),   Decimal("200.00"), True),
        ("Pan wrap",         "u",  Decimal("100"),   Decimal("180.00"), True),
        ("Carne vacuna",     "g",  Decimal("20000"), Decimal("2.50"),   False),
        ("Pollo grillado",   "g",  Decimal("15000"), Decimal("1.80"),   False),
        ("Queso cheddar",    "g",  Decimal("8000"),  Decimal("1.80"),   True),
        ("Queso mozzarella", "g",  Decimal("6000"),  Decimal("1.60"),   True),
        ("Lechuga",          "g",  Decimal("5000"),  Decimal("0.50"),   False),
        ("Tomate",           "g",  Decimal("5000"),  Decimal("0.60"),   False),
        ("Cebolla morada",   "g",  Decimal("3000"),  Decimal("0.40"),   False),
        ("Pepino",           "g",  Decimal("3000"),  Decimal("0.35"),   False),
        ("Palta",            "g",  Decimal("4000"),  Decimal("2.00"),   False),
        ("Salsa especial",   "mL", Decimal("3000"),  Decimal("0.90"),   False),
        ("Mayonesa",         "mL", Decimal("3000"),  Decimal("0.70"),   True),
        ("Mostaza",          "mL", Decimal("2000"),  Decimal("0.60"),   False),
    ]

    for nombre, simbolo, stock, precio, alergeno in datos:
        if nombre not in existentes:
            nuevo = uow.ingredientes.crear(IngredienteCreate(
                nombre=nombre,
                unidad_medida_id=um[simbolo],
                stock_total=stock,
                precio_costo=precio,
                es_alergeno=alergeno,
            ))
            existentes[nombre] = nuevo
        elif existentes[nombre].unidad_medida_id is None:
            # Ingrediente existente sin unidad (creado manualmente) → la asignamos
            actualizado = uow.ingredientes.actualizar(
                existentes[nombre], {"unidad_medida_id": um[simbolo]}
            )
            existentes[nombre] = actualizado
    return existentes


def _seed_productos(uow, cat: dict[str, int], ing: dict[str, Ingrediente]) -> None:
    existentes = {p.nombre for p in uow.productos.obtener_todos(limit=200)}

    def ac(nombre: str, es_principal: bool = True) -> CategoriaAsignacion:
        return CategoriaAsignacion(categoria_id=cat[nombre], es_principal=es_principal)

    def ai(nombre: str, cantidad, es_removible: bool = False) -> IngredienteAsignacion:
        i = ing[nombre]
        return IngredienteAsignacion(
            ingrediente_id=i.id,
            cantidad=Decimal(str(cantidad)),
            unidad_medida_id=i.unidad_medida_id,
            es_removible=es_removible,
        )

    # ── 20 productos con ingredientes ─────────────────────────────────────────

    con_ingredientes: list[ProductoCreate] = [
        # Hamburguesas (10)
        ProductoCreate(
            nombre="Hamburguesa Clásica", margen_ganancia=Decimal("30"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 200),
                ai("Queso cheddar", 50, True),
                ai("Lechuga", 30, True),
                ai("Tomate", 40, True),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Doble", margen_ganancia=Decimal("35"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 400),
                ai("Queso cheddar", 100, True),
                ai("Lechuga", 30, True),
                ai("Tomate", 40, True),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa BBQ", margen_ganancia=Decimal("30"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 200),
                ai("Queso cheddar", 50, True),
                ai("Cebolla morada", 30, True),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Vegetariana", margen_ganancia=Decimal("25"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan integral", 1),
                ai("Queso mozzarella", 80, True),
                ai("Lechuga", 50, True),
                ai("Tomate", 40, True),
                ai("Palta", 30, True),
                ai("Mayonesa", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Pollo", margen_ganancia=Decimal("28"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Pollo grillado", 180),
                ai("Lechuga", 50, True),
                ai("Tomate", 40, True),
                ai("Mayonesa", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Completa", margen_ganancia=Decimal("32"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 200),
                ai("Queso cheddar", 50, True),
                ai("Lechuga", 30, True),
                ai("Tomate", 40, True),
                ai("Cebolla morada", 20, True),
                ai("Salsa especial", 20, True),
                ai("Mayonesa", 15, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Cheddar Doble", margen_ganancia=Decimal("38"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 300),
                ai("Queso cheddar", 100, True),
                ai("Salsa especial", 20, True),
                ai("Mostaza", 15, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Palta", margen_ganancia=Decimal("33"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 200),
                ai("Palta", 80, True),
                ai("Lechuga", 30, True),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Crispy", margen_ganancia=Decimal("30"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Pollo grillado", 180),
                ai("Queso cheddar", 50, True),
                ai("Lechuga", 30, True),
                ai("Mayonesa", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Hamburguesa Gourmet", margen_ganancia=Decimal("40"),
            categorias=[ac("Hamburguesas")],
            ingredientes=[
                ai("Pan brioche", 1),
                ai("Carne vacuna", 250),
                ai("Queso mozzarella", 80, True),
                ai("Palta", 50, True),
                ai("Cebolla morada", 30, True),
                ai("Salsa especial", 20, True),
                ai("Mostaza", 15, True),
            ],
        ),
        # Sandwiches (5)
        ProductoCreate(
            nombre="Sandwich Pollo Clásico", margen_ganancia=Decimal("28"),
            categorias=[ac("Sandwiches")],
            ingredientes=[
                ai("Pan integral", 1),
                ai("Pollo grillado", 150),
                ai("Lechuga", 40, True),
                ai("Tomate", 30, True),
                ai("Mayonesa", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Sandwich de Palta", margen_ganancia=Decimal("25"),
            categorias=[ac("Sandwiches")],
            ingredientes=[
                ai("Pan integral", 1),
                ai("Palta", 80),
                ai("Tomate", 40, True),
                ai("Pepino", 30, True),
                ai("Mayonesa", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Wrap Pollo", margen_ganancia=Decimal("27"),
            categorias=[ac("Sandwiches")],
            ingredientes=[
                ai("Pan wrap", 1),
                ai("Pollo grillado", 150),
                ai("Lechuga", 40, True),
                ai("Tomate", 30, True),
                ai("Cebolla morada", 20, True),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Wrap Veggie", margen_ganancia=Decimal("22"),
            categorias=[ac("Sandwiches")],
            ingredientes=[
                ai("Pan wrap", 1),
                ai("Queso mozzarella", 60, True),
                ai("Lechuga", 50, True),
                ai("Tomate", 40, True),
                ai("Pepino", 30, True),
                ai("Palta", 30, True),
            ],
        ),
        ProductoCreate(
            nombre="Sandwich Mixto", margen_ganancia=Decimal("30"),
            categorias=[ac("Sandwiches")],
            ingredientes=[
                ai("Pan integral", 1),
                ai("Pollo grillado", 100),
                ai("Queso cheddar", 50, True),
                ai("Lechuga", 30, True),
                ai("Mostaza", 20, True),
            ],
        ),
        # Ensaladas (5)
        ProductoCreate(
            nombre="Ensalada Verde", margen_ganancia=Decimal("40"),
            categorias=[ac("Ensaladas")],
            ingredientes=[
                ai("Lechuga", 100),
                ai("Tomate", 80),
                ai("Pepino", 60),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Ensalada Pollo", margen_ganancia=Decimal("38"),
            categorias=[ac("Ensaladas")],
            ingredientes=[
                ai("Pollo grillado", 150),
                ai("Lechuga", 80),
                ai("Tomate", 60),
                ai("Pepino", 40),
                ai("Mayonesa", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Ensalada Caprese", margen_ganancia=Decimal("42"),
            categorias=[ac("Ensaladas")],
            ingredientes=[
                ai("Queso mozzarella", 100),
                ai("Tomate", 80),
                ai("Salsa especial", 30, True),
            ],
        ),
        ProductoCreate(
            nombre="Ensalada Completa", margen_ganancia=Decimal("35"),
            categorias=[ac("Ensaladas")],
            ingredientes=[
                ai("Lechuga", 100),
                ai("Tomate", 80),
                ai("Pepino", 60),
                ai("Cebolla morada", 50, True),
                ai("Palta", 80, True),
                ai("Salsa especial", 20, True),
            ],
        ),
        ProductoCreate(
            nombre="Ensalada Griega", margen_ganancia=Decimal("40"),
            categorias=[ac("Ensaladas")],
            ingredientes=[
                ai("Lechuga", 100),
                ai("Tomate", 80),
                ai("Pepino", 60),
                ai("Queso mozzarella", 50, True),
                ai("Cebolla morada", 20, True),
                ai("Salsa especial", 20, True),
            ],
        ),
    ]

    # ── 10 productos sin ingredientes (stock directo) ─────────────────────────

    sin_ingredientes: list[ProductoCreate] = [
        ProductoCreate(nombre="Coca Cola 500ml",     categorias=[ac("Bebidas")], stock_directo=80, precio_base=Decimal("700.00")),
        ProductoCreate(nombre="Agua Mineral 500ml",  categorias=[ac("Bebidas")], stock_directo=80, precio_base=Decimal("400.00")),
        ProductoCreate(nombre="Jugo de Naranja",      categorias=[ac("Bebidas")], stock_directo=50, precio_base=Decimal("600.00")),
        ProductoCreate(nombre="Limonada 400ml",       categorias=[ac("Bebidas")], stock_directo=50, precio_base=Decimal("550.00")),
        ProductoCreate(nombre="Cerveza Artesanal",    categorias=[ac("Bebidas")], stock_directo=40, precio_base=Decimal("900.00")),
        ProductoCreate(nombre="Brownie de Chocolate", categorias=[ac("Postres")], stock_directo=30, precio_base=Decimal("800.00")),
        ProductoCreate(nombre="Cheesecake",           categorias=[ac("Postres")], stock_directo=25, precio_base=Decimal("1000.00")),
        ProductoCreate(nombre="Helado 2 bochas",      categorias=[ac("Postres")], stock_directo=40, precio_base=Decimal("650.00")),
        ProductoCreate(nombre="Tiramisú",             categorias=[ac("Postres")], stock_directo=20, precio_base=Decimal("950.00")),
        ProductoCreate(nombre="Medialunas x3",        categorias=[ac("Postres")], stock_directo=35, precio_base=Decimal("500.00")),
    ]

    for datos in con_ingredientes + sin_ingredientes:
        if datos.nombre not in existentes:
            uow.productos.crear(datos)


# ── Entry point ───────────────────────────────────────────────────────────────

def ejecutar_seed() -> None:
    with UnidadDeTrabajo() as uow:
        for rol in ROLES_INICIALES:
            if not uow.roles.obtener_por_codigo(rol.codigo):
                uow.roles.crear(rol)

        for estado in ESTADOS_PEDIDO_INICIALES:
            if not uow.estados_pedido.obtener_por_codigo(estado.codigo):
                uow.estados_pedido.crear(estado)

        for forma in FORMAS_PAGO_INICIALES:
            if not uow.formas_pago.obtener_por_codigo(forma.codigo):
                uow.formas_pago.crear(forma)

        for unidad in UNIDADES_INICIALES:
            existentes = uow.unidades_medida.obtener_todos(tipo=unidad.tipo)
            simbolos = {u.simbolo for u in existentes}
            if unidad.simbolo not in simbolos:
                from app.schemas.unidad_medida import UnidadMedidaCrear
                uow.unidades_medida.crear(
                    UnidadMedidaCrear(
                        nombre=unidad.nombre,
                        simbolo=unidad.simbolo,
                        tipo=unidad.tipo,
                    )
                )

        if not uow.usuarios.obtener_por_email(ADMIN_EMAIL):
            admin = Usuario(
                nombre="Admin",
                apellido="Sistema",
                email=ADMIN_EMAIL,
                celular="0000000000",
                password_hash=hashear_contrasena(ADMIN_PASSWORD),
            )
            admin = uow.usuarios.crear(admin)
            uow.usuario_roles.asignar(
                UsuarioRol(usuario_id=admin.id, rol_codigo="ADMIN")
            )

        # Usuario STOCK (pruebas)
        if not uow.usuarios.obtener_por_email("stock@foodstore.com"):
            stock = Usuario(
                nombre="Stock", apellido="Manager",
                email="stock@foodstore.com", celular="0000000001",
                password_hash=hashear_contrasena("Stock1234!"),
            )
            stock = uow.usuarios.crear(stock)
            uow.usuario_roles.asignar(UsuarioRol(usuario_id=stock.id, rol_codigo="STOCK"))

        # Usuario PEDIDOS (pruebas)
        if not uow.usuarios.obtener_por_email("pedidos@foodstore.com"):
            pedidos = Usuario(
                nombre="Pedidos", apellido="Manager",
                email="pedidos@foodstore.com", celular="0000000002",
                password_hash=hashear_contrasena("Pedidos1234!"),
            )
            pedidos = uow.usuarios.crear(pedidos)
            uow.usuario_roles.asignar(UsuarioRol(usuario_id=pedidos.id, rol_codigo="PEDIDOS"))

        # Usuario CLIENT (pruebas)
        if not uow.usuarios.obtener_por_email("cliente@foodstore.com"):
            cliente = Usuario(
                nombre="Cliente", apellido="Test",
                email="cliente@foodstore.com", celular="0000000003",
                password_hash=hashear_contrasena("Cliente1234!"),
            )
            cliente = uow.usuarios.crear(cliente)
            uow.usuario_roles.asignar(UsuarioRol(usuario_id=cliente.id, rol_codigo="CLIENT"))

            # Direcciones de demo para el cliente
            from app.models.direccion_entrega import DireccionEntrega
            dir1 = DireccionEntrega(
                usuario_id=cliente.id, alias="Casa",
                linea1="Calle Falsa 123", ciudad="Buenos Aires",
                provincia="Buenos Aires", codigo_postal="C1425",
                es_principal=True,
            )
            dir2 = DireccionEntrega(
                usuario_id=cliente.id, alias="Trabajo",
                linea1="Av. Corrientes 456", linea2="Piso 3, Dpto B",
                ciudad="CABA", provincia="Buenos Aires",
                codigo_postal="C1043", es_principal=False,
            )
            uow.sesion.add(dir1)
            uow.sesion.add(dir2)
            uow.sesion.flush()

        cat_ids = _seed_categorias(uow)
        ing_ids = _seed_ingredientes(uow)
        _seed_productos(uow, cat_ids, ing_ids)

        # ── Direcciones demo para cliente ────────────────────────────────────────
        cliente = uow.usuarios.obtener_por_email("cliente@foodstore.com")
        if cliente:
            from app.models.direccion_entrega import DireccionEntrega
            from sqlmodel import select as seed_select
            dirs = uow.sesion.exec(
                seed_select(DireccionEntrega).where(
                    DireccionEntrega.usuario_id == cliente.id,
                    DireccionEntrega.deleted_at == None,  # noqa: E711
                )
            ).all()
            if not dirs:
                dir1 = DireccionEntrega(
                    usuario_id=cliente.id, alias="Casa",
                    linea1="Calle Falsa 123", ciudad="Buenos Aires",
                    provincia="Buenos Aires", codigo_postal="C1425",
                    es_principal=True,
                )
                dir2 = DireccionEntrega(
                    usuario_id=cliente.id, alias="Trabajo",
                    linea1="Av. Corrientes 456", linea2="Piso 3, Dpto B",
                    ciudad="CABA", provincia="Buenos Aires",
                    codigo_postal="C1043", es_principal=False,
                )
                uow.sesion.add(dir1)
                uow.sesion.add(dir2)
                uow.sesion.flush()
