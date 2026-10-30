// Production JSON Server for hosts like Render / Railway (not for Netlify).
import jsonServer from 'json-server';

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults(); // includes CORS + 10 MB JSON body parser (for image uploads)

server.use(middlewares);
server.use(router);

const port = process.env.PORT || 3001;
server.listen(port, '0.0.0.0', () => console.log(`JSON Server running on port ${port}`));
