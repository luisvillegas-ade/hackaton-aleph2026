# Chakai

> Control de versiones y colaboración para proyectos musicales. Como git, pero para tu DAW — y sin servidor.

Aleph Hackathon 2026 — chapter Salta · **Pears Track** + **General Track**

**Dos músicos graban pistas distintas al mismo tiempo, cada uno en su casa, y el proyecto termina con las dos.** Sin servidor, sin turnos, sin pisarse.

## El problema

Una banda graba en estudios caseros distintos, y hoy se pasa el trabajo por WhatsApp (que comprime el audio), WeTransfer (que vence a los 7 días) o Drive (que se llena). Todos tienen un servidor de una empresa en el medio, que cuesta plata y decide cuánto dura tu música.

Pero el problema de fondo es otro, y es doble:

**1. Un proyecto de DAW no es un archivo.** Un proyecto de Ableton Live o Reaper es un árbol de carpetas — el `.als`, `Samples/`, `Ableton Project Info/` — y si la estructura se pierde, el proyecto no abre. Por eso se termina comprimiendo todo en un ZIP y subiéndolo entero cada vez que cambian dos compases.

**2. No hay historial.** El programador tiene git desde hace veinte años: puede volver a como estaba ayer, ver qué cambió, recuperar lo que rompió. El músico tiene `mezcla_final_v3_ESTA_SI.als` y un `Backup/` que nadie entiende. Si a las dos de la mañana arruinás la mezcla, no hay vuelta atrás.

Chakai resuelve las dos: manda la carpeta completa con su estructura intacta, y le pone un historial de versiones que viaja con el proyecto.

## Cómo se usa

Todos los músicos abren el mismo proyecto. No hay un rol privilegiado: **cualquiera graba y todos reciben.**

El primero abre la sesión con su carpeta:

```sh
chakai open "Beto Prueba"
```

Eso imprime un código. El resto entra con él, cada uno apuntando a su propia copia:

```sh
chakai open "mi Beto Prueba" <codigo>
```

A partir de ahí cada uno trabaja en su DAW como siempre. Cuando guardás, Chakai publica los cambios solo, y los del resto aparecen en tu proyecto. **Si dos graban pistas distintas al mismo tiempo, el proyecto termina con las dos**: los `.rpp` se fusionan por pista, no se pisan.

### Modo distribución (uno a muchos)

Si en cambio querés repartir un proyecto sin que los demás escriban — mandarle los stems a la banda para que los escuchen — está `share`:

```sh
chakai share ecos "Ecos de la Pacha/tema_principal Project"
```

Eso comparte **y se queda vigilando**. Cada vez que guardás en el DAW, Chakai registra una _toma_ nueva solo — no hay que acordarse de nada. Espera a que la escritura se calme antes de guardar, así una ráfaga de autoguardado no genera treinta versiones basura.

Te imprime un código. Se lo pasás a la banda una sola vez, y no volvés a mandar archivos nunca más.

Los demás entran:

```sh
chakai join <codigo> ./mis-proyectos
```

El proyecto se reconstruye igual del otro lado, subdirectorios incluidos: se abre en el DAW y listo. Y queda **sincronizando**: cuando vos guardás una toma nueva, les llega sola.

### El historial

```sh
chakai log ecos
```

```
Historial de "ecos" — 2 toma(s)

#2  2026-08-22 18:46
     ~ Ecos Project/tema.als
     ~ Ecos Project/Samples/bajo.wav
#1  2026-08-22 18:45
     ~ Ecos Project/tema.als
     ~ Ecos Project/Samples/bombo.wav
```

Y cuando rompiste la mezcla:

```sh
chakai restore ecos 1
```

El historial vive **dentro del proyecto**, así que no es un registro local tuyo: cuando un compañero se une, recibe también toda la historia de tomas.

### Por qué no hace falta reenviar todo

Hyperdrive transfiere solo los bloques que cambiaron. Si editás dos compases de un proyecto de 2 GB, viaja la diferencia, no los 2 GB. Eso es justo lo que un ZIP en WeTransfer no puede hacer.

Y quien descargó queda también compartiendo, así que cuantos más son, mejor anda.

Probado con un proyecto real de Ableton Live: 11 archivos entre `Backup/`, `Samples/` y `Ableton Project Info/`, todos verificados idénticos byte a byte del otro lado.

## Instalación

> **Si estás en Windows, corré esto primero.** La consola de Windows no usa UTF-8 por defecto y la interfaz de Chakai se ve como caracteres rotos. Una sola línea lo arregla para esa sesión de terminal:
>
> ```sh
> chcp 65001
> ```

```sh
pear install --timeout 300 pear://ipuh57fdpuh5fxcc7533g67wttmxb8ajhobbykzd5z8cfdtcepwo
```

No hay descarga desde una web ni app store: el binario viaja por la misma red P2P. Las actualizaciones también — si publicamos una versión nueva, te llega sola.

> **El `--timeout 300` no es opcional en la práctica.** El valor por defecto de `pear install` es 30 segundos, y entre descubrir un par y bajar el binario (55–94 MB según la plataforma) se agota. Si ves `Network Timeout 30s`, no es que no haya nadie sirviendo el proyecto: es que no llegó a tiempo. Con 300 segundos entra cómodo.

### Si después de instalar `chakai` no se encuentra

En Linux y macOS el binario queda en `~/.local/bin`. Si esa carpeta no está en tu `PATH`, la instalación funciona pero el comando no aparece:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Para dejarlo fijo, agregá esa línea a `~/.bashrc` o `~/.zshrc`.

Para reinstalar sobre una versión existente hay que borrarla primero (`pear install` no pisa lo que ya está):

```sh
rm ~/.local/bin/chakai && pear install pear://ipuh57fdpuh5fxcc7533g67wttmxb8ajhobbykzd5z8cfdtcepwo
```

## Cómo está hecho

Construido sobre el stack de Holepunch, partiendo del template oficial [`hello-pear-bare`](https://github.com/holepunchto/hello-pear-bare), **variante `main`** (el updater corre en un worker thread, que es lo indicado para un programa que queda abierto).

| Pieza            | Para qué                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hyperdrive**   | El sistema de archivos que se replica entre pares. Una sala = un drive. Su historial de versiones (`version`, `checkout`, `diff`) es lo que hace posible `log` y `restore`. |
| **Corestore**    | Guarda los datos del drive en disco.                                                                                                                                        |
| **Hyperswarm**   | Encuentra a los otros músicos. Se une a la `discoveryKey`, que es un hash de la clave pública — así, alguien que mire la red no puede deducir el código de la sala.         |
| **Bare**         | El runtime. Compila a un binario por sistema operativo, sin necesidad de instalar Node.                                                                                     |
| **pear-runtime** | Las actualizaciones over-the-air, peer-to-peer.                                                                                                                             |

El control de versiones no se construyó desde cero: Hypercore, que está debajo de Hyperdrive, es un registro de solo-agregado. Cada escritura deja la anterior intacta y accesible. Chakai expone eso en términos que un músico entiende.

Código relevante: [`lib/session.js`](lib/session.js) (sesión multi-escritura e intercambio de claves), [`lib/sync.js`](lib/sync.js) (unión de los drives sobre la carpeta local), [`lib/rpp.js`](lib/rpp.js) (fusión por pista), [`lib/watch.js`](lib/watch.js) (detección de cambios), [`lib/versions.js`](lib/versions.js) (historial de tomas) y [`bin.mjs`](bin.mjs) (comandos).

### Por qué "tomas" y no versiones del drive

`drive.version` sube una vez por archivo escrito: un solo guardado de Ableton puede moverla de 4 a 15. Ese número no le sirve a nadie. Chakai agrupa los archivos que cambiaron juntos en una **toma**, con su fecha, y guarda ese índice en `/.chakai/history.json` dentro del propio drive — así el historial viaja a toda la banda, y se excluye al escribir el proyecto en disco.

### Cómo se detectan los cambios

Recorriendo la carpeta cada pocos segundos y comparando tamaño y fecha de modificación, en vez de usar `fs.watch` (que en Bare es terreno incierto). Un DAW guarda en ráfagas — el `.als`, después los samples, después el índice — así que se espera a que pase un ciclo entero sin movimiento antes de cerrar la toma. Sin eso saldrían decenas de versiones basura, algunas con archivos a medio escribir.

### Seguridad del código de sala

El código que se comparte es la clave pública del drive. El swarm se une a la `discoveryKey` (un hash de esa clave), no a la clave misma. Alguien que observe el tráfico de la red ve el hash pero no puede reconstruir la clave, así que no puede leer el contenido de la sala.

## Plataformas compiladas

- Linux x64 y arm64
- Windows x64 y arm64
- macOS Apple Silicon (arm64) e Intel (x64)

Cada instalación descarga únicamente el binario de su plataforma, no las seis.

### Cuándo se buscan actualizaciones

El updater mantiene su estado en un Corestore con lock exclusivo: dos procesos no pueden tenerlo abierto a la vez. Como tener varias salas abiertas al mismo tiempo (una por canción) es el uso normal, el updater corre **solo en la invocación sin comando**:

```sh
chakai          # busca actualizaciones y muestra la ayuda
chakai share …  # mueve archivos, sin updater
chakai join …   # ídem
```

Así nunca compiten por el lock. Sin esto, la segunda ventana abortaba con `Corestore is closed`, lanzado de forma asíncrona desde su worker — un error que ningún `try/catch` del hilo principal puede atrapar.

## Límites, dicho de frente

- **Es de un solo escritor.** Quien abre la sala es el que puede agregar archivos y registrar tomas; los demás sincronizan y pueden recuperar cualquier toma, pero no escribir. Para que toda la banda escriba en la misma sala hace falta Autobase, que quedó fuera del alcance de un fin de semana. Hoy el modelo es el de un estudio: alguien lleva la sesión, el resto la sigue.
- **Alguien tiene que estar en línea.** Es inherente al P2P: si nadie que tenga el archivo está conectado, no hay de dónde bajarlo. En una banda trabajando sobre el mismo tema en general hay alguien con la máquina abierta, y cada persona que descarga pasa a ser una fuente más. Pero no es magia: no reemplazamos el servidor por nada, lo reemplazamos por las computadoras de la propia banda.
- **Los archivos se cargan enteros en memoria** al subir y bajar. Anda bien con stems normales; para sesiones de varios GB habría que pasar a streams.
- **`restore` escribe en una carpeta aparte**, no pisa el proyecto original. Es a propósito: preferimos que el músico compare y decida antes de sobrescribir su sesión.
- **La detección de cambios es por sondeo**, cada 3 segundos. Un cambio puede tardar unos segundos en registrarse. Para el ritmo de trabajo de una sesión de música es de sobra, pero no es instantáneo.

## Comandos

| Comando                                  | Qué hace                                                     |
| ---------------------------------------- | ------------------------------------------------------------ |
| `chakai share <sala> <carpeta>`          | Comparte el proyecto y vigila los cambios, registrando tomas |
| `chakai join <codigo> [carpeta]`         | Descarga el proyecto y queda sincronizando                   |
| `chakai log <sala>`                      | Historial de tomas, con fecha y qué cambió                   |
| `chakai restore <sala> <toma> [carpeta]` | Recupera el proyecto como estaba en esa toma                 |
| `chakai`                                 | Muestra la ayuda y busca actualizaciones                     |

## Desarrollo

```sh
npm install
npm start -- share ecos "ruta/al/Proyecto"   # compartir y vigilar
npm start -- join <codigo> ./descargas       # descargar y sincronizar
npm start -- log ecos                        # historial
npm start -- restore ecos 1 ./vuelta         # recuperar una toma
```

Para compilar los binarios:

```sh
npm run make                # el de tu sistema
npm run make:win32-x64      # o uno específico
```

## Licencia

Apache-2.0
