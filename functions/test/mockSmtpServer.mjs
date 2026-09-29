
import net from "node:net";
import http from "node:http";

const HOST = "127.0.0.1";
const SMTP_PORT = 2525;
const CONTROL_PORT = 2526;

const messages = [];
let nextMessageId = 1;

function respondJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  response.end(JSON.stringify(data));
}

const controlServer = http.createServer(
  (request, response) => {
    if (
      request.method === "POST" &&
      request.url === "/reset"
    ) {
      messages.length = 0;
      nextMessageId = 1;

      respondJson(response, 200, {
        success: true,
        messageCount: 0,
      });

      return;
    }

    if (
      request.method === "GET" &&
      request.url === "/messages"
    ) {
      respondJson(response, 200, {
        messageCount: messages.length,
        messages: messages.map((message) => ({
          id: message.id,
          from: message.from,
          recipients: message.recipients,
        })),
      });

      return;
    }

    respondJson(response, 404, {
      error: "Not found",
    });
  }
);

const smtpServer = net.createServer((socket) => {
  socket.setEncoding("utf8");

  let buffer = "";
  let receivingData = false;
  let sender = "";
  let recipients = [];

  socket.write(
    "220 HealthPassport Local Test SMTP\r\n"
  );

  socket.on("data", (chunk) => {
    buffer += chunk;

    while (true) {
      const lineEnd = buffer.indexOf("\r\n");

      if (lineEnd === -1) {
        break;
      }

      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);

      if (receivingData) {
        if (line === ".") {
          receivingData = false;

          messages.push({
            id: nextMessageId++,
            from: sender,
            recipients: [...recipients],
          });

          socket.write(
            "250 Message accepted\r\n"
          );

          sender = "";
          recipients = [];
        }

        continue;
      }

      const command = line.toUpperCase();

      if (
        command.startsWith("EHLO ") ||
        command.startsWith("HELO ")
      ) {
        socket.write(
          "250-localhost\r\n" +
          "250 SIZE 1000000\r\n"
        );
      } else if (
        command.startsWith("MAIL FROM:")
      ) {
        sender = line.slice(10).trim();
        recipients = [];

        socket.write(
          "250 Sender accepted\r\n"
        );
      } else if (
        command.startsWith("RCPT TO:")
      ) {
        const recipient =
          line.slice(8).trim();

        if (
          recipient
            .toLowerCase()
            .includes("reject@example.com")
        ) {
          socket.write(
            "550 Simulated recipient rejection\r\n"
          );
        } else {
          recipients.push(recipient);

          socket.write(
            "250 Recipient accepted\r\n"
          );
        }
      } else if (command === "DATA") {
        if (recipients.length === 0) {
          socket.write(
            "554 No accepted recipients\r\n"
          );
        } else {
          receivingData = true;

          socket.write(
            "354 End data with <CRLF>.<CRLF>\r\n"
          );
        }
      } else if (command === "RSET") {
        sender = "";
        recipients = [];
        receivingData = false;

        socket.write("250 Reset\r\n");
      } else if (command === "QUIT") {
        socket.write("221 Goodbye\r\n");
        socket.end();
      } else {
        socket.write(
          "502 Command not implemented\r\n"
        );
      }
    }
  });

  socket.on("error", (error) => {
    console.error(
      "SMTP socket error:",
      error.message
    );
  });
});

smtpServer.listen(
  SMTP_PORT,
  HOST,
  () => {
    console.log(
      `SMTP test server: ${HOST}:${SMTP_PORT}`
    );
  }
);

controlServer.listen(
  CONTROL_PORT,
  HOST,
  () => {
    console.log(
      `Test control endpoint: http://${HOST}:${CONTROL_PORT}`
    );
  }
);

function shutdown() {
  smtpServer.close();
  controlServer.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);