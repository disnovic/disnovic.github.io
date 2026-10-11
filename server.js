const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const dataDirectory = path.join(root, "data");
const counterFile = path.join(dataDirectory, "views.json");
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
};

let countQueue = Promise.resolve();

async function readCount() {
  try {
    const data = JSON.parse(await fsp.readFile(counterFile, "utf8"));
    if (!Number.isSafeInteger(data.views) || data.views < 0) {
      throw new Error("O arquivo persistente de views tem um valor inválido.");
    }
    return data.views;
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

function jsonResponse(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

async function handleViews(request, response) {
  if (request.method === "GET") {
    jsonResponse(response, 200, { views: await readCount() });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    jsonResponse(response, 405, { error: "Método não permitido." });
    return;
  }

  const increment = countQueue.then(async () => {
    const views = (await readCount()) + 1;
    await fsp.mkdir(dataDirectory, { recursive: true });
    await fsp.writeFile(counterFile, JSON.stringify({ views }), "utf8");
    return views;
  });
  countQueue = increment.catch(() => {});
  jsonResponse(response, 200, { views: await increment });
}

async function serveStatic(request, response, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!mimeTypes[extension] || filePath === __filename || filePath.startsWith(`${dataDirectory}${path.sep}`)) {
    response.writeHead(404).end("Not found");
    return;
  }

  let fileInfo;
  try {
    fileInfo = await fsp.stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404).end("Not found");
      return;
    }
    throw error;
  }

  if (!fileInfo.isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }

  const headers = {
    "Accept-Ranges": "bytes",
    "Content-Type": mimeTypes[extension],
    "X-Content-Type-Options": "nosniff",
  };
  const isVideo = extension === ".mp4" || extension === ".webm";
  const rangeHeader = request.headers.range;
  if (isVideo) {
    headers["Accept-Ranges"] = "bytes";
  }

  let start = 0;
  let end = fileInfo.size - 1;
  let statusCode = 200;

  if (rangeHeader && isVideo) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { "Content-Range": `bytes */${fileInfo.size}` }).end();
      return;
    }

    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
    } else {
      const suffixLength = Number(match[2]);
      start = Math.max(fileInfo.size - suffixLength, 0);
    }

    if (start >= fileInfo.size || end < start || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      response.writeHead(416, { "Content-Range": `bytes */${fileInfo.size}` }).end();
      return;
    }

    end = Math.min(end, fileInfo.size - 1);
    statusCode = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${fileInfo.size}`;
  }

  headers["Content-Length"] = end - start + 1;
  response.writeHead(statusCode, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = fs.createReadStream(filePath, { start, end });
  stream.on("error", (error) => {
    console.error("Erro ao transmitir arquivo estático:", error);
    response.destroy(error);
  });
  stream.pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/api/views") {
      await handleViews(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
      return;
    }
    await serveStatic(request, response, pathname);
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    if (!response.headersSent) {
      jsonResponse(response, 500, { error: "Erro interno do servidor." });
    } else {
      response.destroy(error);
    }
  }
});

server.listen(port, () => {
  console.log(`Biosite disponível em http://localhost:${port}`);
});