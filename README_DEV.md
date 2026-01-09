Local development instructions

1) Install server deps and initialize database

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
```

Place the provided images (attached) at:

- `server/public/images/airport-scene.jpg` (first round image)
- `server/public/images/waldo-pic1.jpg` (second round image — the stripy-shirt character)

If you use different filenames, update `server/prisma/seed.js` accordingly.
If you use a different filename, update `server/prisma/seed.js` accordingly.

2) Run server

```bash
cd server
npm run dev
```

3) Install and run client

```bash
cd client
npm install
npm run dev
```

Client expects backend at `http://localhost:4000`.
