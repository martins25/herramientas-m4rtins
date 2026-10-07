# Herramientas de Ciberseguridad — m4rtins.com

Código fuente de las herramientas gratuitas de ciberseguridad publicadas en
**[m4rtins.com/herramientas](https://m4rtins.com/herramientas)**.

Este repositorio existe por una razón: **transparencia**. No tienes que creer
que "tus datos no salen de tu navegador" — puedes comprobarlo tú mismo leyendo
el código.

## 🔒 Principio de privacidad

Todas las herramientas se ejecutan **100% en el navegador (client-side)**. No hay
backend, no hay base de datos y **no se envían datos personales a ningún servidor**.
Tu contraseña, tu DNI o tus mensajes nunca salen de tu dispositivo.

### Única excepción (y por qué)

La herramienta **«¿Tu contraseña está filtrada?»** necesita comparar tu
contraseña contra diccionarios de filtraciones (rockyou, SecLists…) que suman
millones de entradas. Para hacerlo **sin enviar tu contraseña**, usa la técnica
de *k-anonymity*:

1. Calcula el hash **SHA-1 en tu navegador**.
2. De ese hash toma solo los **2 primeros caracteres** (el "prefijo") y descarga
   el pequeño fragmento del diccionario correspondiente (`/pwned/<prefijo>.txt`).
3. La comparación se hace **en local**.

Es decir: ni tu contraseña ni tu hash completo salen nunca de tu equipo; lo único
observable es a qué "cubo" de 2 caracteres pertenece. El código está en
[`pages/tools/PwnedPasswordPage.tsx`](pages/tools/PwnedPasswordPage.tsx).

## 🧰 Herramientas incluidas

- **Marca de agua para el DNI** — protege copias de documentos de identidad.
- **Generador de contraseñas y wallets** (BIP39).
- **¿Cuál es mi IP?** (IPv4/IPv6, ISP, SO).
- **Mensajes ocultos en emojis** (AES-256-GCM + Argon2id).
- **¿Tu contraseña está filtrada?** (k-anonymity).
- **Calculadora de subredes / CIDR.**
- **Decodificador de JWT.**
- **Generador de hashes** (MD5, SHA-1/256/384/512).
- **Codificador Base64 y URL.**

## 🚀 Ejecutar en local

Requiere Node 18+.

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run build    # build de producción en dist/
```

### Diccionarios de contraseñas

La carpeta `public/pwned/` (los diccionarios troceados por prefijo) **no se
incluye** en el repositorio por su tamaño. Para que la herramienta de contraseñas
filtradas funcione en local, genérala con:

```bash
node scripts/build-pwned.mjs /ruta/a/rockyou.txt
```

El resto de herramientas funcionan sin este paso.

## ⚙️ Tecnología

React 19 · TypeScript · Vite · Tailwind CSS · WebCrypto · hash-wasm (Argon2id) ·
spark-md5. Sin telemetría ni dependencias de terceros en tiempo de ejecución.

## ⚠️ Aviso

Software proporcionado sin garantías; úsalo bajo tu propia responsabilidad.

## 📄 Licencia

[MIT](LICENSE) © Adrián Martín · [m4rtins.com](https://m4rtins.com)
