import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";

const root = process.cwd();
const port = Number(process.env.PORT || 8080);
const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};

http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
        const filePath = path.resolve(root, `.${requestedPath}`);

        if (!filePath.startsWith(root)) {
            throw new Error("Invalid path");
        }

        const fileStat = await stat(filePath);
        const finalPath = fileStat.isDirectory() ? path.join(filePath, "index.html") : filePath;
        const body = await readFile(finalPath);

        response.writeHead(200, {
            "Content-Type": contentTypes[path.extname(finalPath)] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        response.end(body);
    } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`JerkMaster dev server: http://127.0.0.1:${port}`);
});
