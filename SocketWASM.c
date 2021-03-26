#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/time.h>
#include <sys/socket.h>
#include <arpa/inet.h>

#ifdef __EMSCRIPTEN__
	#include <emscripten.h>
#endif

#define WASM_EXPORT __attribute__((visibility("default")))

struct 	sockaddr_in server;
int 		client, port;
char		evalBuffer[0xFFF],
				host[0x20],
				request[0xFFF], response[0xFFF];

WASM_EXPORT int getHostAddr() { return host; }
WASM_EXPORT int getPortAddr() { return &port; }
WASM_EXPORT int getRequestAddr() { return request; }
WASM_EXPORT int getResponseAddr() { return response; }
WASM_EXPORT int getEvalBufferAddr() { return evalBuffer; }

WASM_EXPORT
int WasmConnect()
{
	close(client);

	if ((client = socket(AF_INET, SOCK_STREAM, 0)) == -1)
		return 1;
	
	server.sin_addr.s_addr = inet_addr(host);
	server.sin_family = AF_INET;
	server.sin_port = htons(port);

	if (connect(client, (struct sockaddr*) &server, sizeof(server)) < 0)
		return 2;
	
	return 0;
}

WASM_EXPORT
int WasmDisconnect()
{
	close(client);
	return 0;
}

WASM_EXPORT
int WasmSend(char *arg_request)
{
	memset(request, 0, sizeof(request));
	memset(response, 0, sizeof(response));
	
	strcpy(request, arg_request);
	send(client, request, strlen(request), 0);
	recv(client, response, 0xFFF, 0);
	
	return 0;
}

WASM_EXPORT
int tick()
{
	//if (evalBuffer[0] == '\0')
	//	stpcpy(evalBuffer, "console.log('Hi!');");
	
	return 0;
}

WASM_EXPORT
int main()
{
	return 0;
}
