# Chakai

> Compartí stems y partituras con tu banda. Sin servidor, sin límite de tamaño, sin que el link venza a los 7 días.

Aleph Hackathon 2026 — chapter Salta · **Pears Track**

## El problema

Una banda graba en estudios caseros distintos. Para pasarse las tomas:

- **WhatsApp** comprime el audio y arruina el stem.
- **WeTransfer** vence a los 7 días.
- **Google Drive** se llena, y hay que pagar para que no se llene.

Todos esos caminos tienen algo en común: un servidor de una empresa en el medio, que cuesta plata y que decide cuánto dura tu música.

## La idea

Chakai comparte los archivos **directamente entre las computadoras de la banda**. No hay servidor: los archivos viven donde vive la música. Mientras alguien del grupo tenga la app abierta, el resto puede bajar.

Es el mismo principio de un torrent, aplicado a una sala de ensayo.

## Cómo se usa

Quien tiene los archivos abre la sala:

```sh
chakai share zamba-nueva bajo-toma3.wav partitura.pdf
```

Eso imprime un código. Se lo pasa a la banda por donde sea (WhatsApp, Telegram) — una sola vez, y no vuelve a mandar archivos nunca más.

Los demás lo bajan:

```sh
chakai join <codigo> ./mis-descargas
```

Los archivos aparecen en la carpeta. Y quien los bajó queda también compartiendo, así que cuantos más son, mejor anda.

## Instalación

```sh
pear install pear://ipuh57fdpuh5fxcc7533g67wttmxb8ajhobbykzd5z8cfdtcepwo
```

No hay descarga desde una web ni app store: el binario viaja por la misma red P2P. Las actualizaciones también — si publicamos una versión nueva, te llega sola.

Para reinstalar sobre una versión existente hay que borrarla primero (`pear install` no pisa lo que ya está):

```sh
rm ~/.local/bin/chakai && pear install pear://ipuh57fdpuh5fxcc7533g67wttmxb8ajhobbykzd5z8cfdtcepwo
```

## Cómo está hecho

Construido sobre el stack de Holepunch, partiendo del template oficial [`hello-pear-bare`](https://github.com/holepunchto/hello-pear-bare), **variante `main`** (el updater corre en un worker thread, que es lo indicado para un programa que queda abierto).

| Pieza | Para qué |
|---|---|
| **Hyperdrive** | El sistema de archivos que se replica entre pares. Una sala = un drive. |
| **Corestore** | Guarda los datos del drive en disco. |
| **Hyperswarm** | Encuentra a los otros músicos. Se une a la `discoveryKey`, que es un hash de la clave pública — así, alguien que mire la red no puede deducir el código de la sala. |
| **Bare** | El runtime. Compila a un binario por sistema operativo, sin necesidad de instalar Node. |
| **pear-runtime** | Las actualizaciones over-the-air, peer-to-peer. |

Código relevante: [`lib/room.js`](lib/room.js) (replicación y archivos) y [`bin.mjs`](bin.mjs) (comandos).

### Seguridad del código de sala

El código que se comparte es la clave pública del drive. El swarm se une a la `discoveryKey` (un hash de esa clave), no a la clave misma. Alguien que observe el tráfico de la red ve el hash pero no puede reconstruir la clave, así que no puede leer el contenido de la sala.

## Plataformas compiladas

- Linux x64
- Windows x64
- macOS Apple Silicon (arm64)
- macOS Intel (x64)

### Cuándo se buscan actualizaciones

El updater mantiene su estado en un Corestore con lock exclusivo: dos procesos no pueden tenerlo abierto a la vez. Como tener varias salas abiertas al mismo tiempo (una por canción) es el uso normal, el updater corre **solo en la invocación sin comando**:

```sh
chakai          # busca actualizaciones y muestra la ayuda
chakai share …  # mueve archivos, sin updater
chakai join …   # ídem
```

Así nunca compiten por el lock. Sin esto, la segunda ventana abortaba con `Corestore is closed`, lanzado de forma asíncrona desde su worker — un error que ningún `try/catch` del hilo principal puede atrapar.

## Límites, dicho de frente

- **Es de un solo escritor.** Quien abre la sala es el que puede agregar archivos; los demás descargan. Para que toda la banda escriba en la misma sala hace falta Autobase, que quedó fuera del alcance de un fin de semana.
- **Alguien tiene que estar en línea.** Es inherente al P2P: si nadie que tenga el archivo está conectado, no hay de dónde bajarlo. En una banda trabajando sobre el mismo tema en general hay alguien con la máquina abierta, y cada persona que descarga pasa a ser una fuente más. Pero no es magia: no reemplazamos el servidor por nada, lo reemplazamos por las computadoras de la propia banda.
- **Los archivos se cargan enteros en memoria** al subir y bajar. Anda bien con stems normales; para sesiones de varios GB habría que pasar a streams.

## Desarrollo

```sh
npm install
npm start -- share prueba archivo.wav      # compartir
npm start -- join <codigo> ./descargas     # descargar
```

Para compilar los binarios:

```sh
npm run make                # el de tu sistema
npm run make:win32-x64      # o uno específico
```

## Licencia

Apache-2.0
