import {Hono} from 'hono';
import {cors} from 'hono/cors';
import fs from 'node:fs';

export const app = new Hono();

app.use('*', cors());

function registrarRuta(ruta) {
    app.get(ruta, async (c) => {
        const json = fs.readFileSync(`./datos${ruta}/index.json`, 'utf8');
        return c.json(JSON.parse(json));
    });
}

function registrarRutas(directorio) {
    const archivos = fs.readdirSync(directorio);
    
    for (const archivo of archivos) {
        const ruta = `${directorio}/${archivo}`;
        
        if (fs.statSync(ruta).isDirectory()) {
            registrarRutas(ruta);
        } else {
            registrarRuta(ruta
                .replace(/^\.\/datos/, '')
                .replace(/\/index\.json$/, ''));
        }
    }
}

registrarRutas('./datos');

export default app;
