/* SocketWASM 0.1
 * https://socketwasm.com
 *
 * Written by 		: Chester Abrahams
 * Portfolio  		: https://atomiccoder.com
 * LinkedIn   		: https://www.linkedin.com/in/atomiccoder/ */

class SocketWASM
{
	#id;
	#connectHost; #connectPort; #connected;
	#request; #response;
	
	#WASM_exports;
	#WASM_timer; #WASM_HZ=60;
	#WASM_obj; #WASM_memObj;
	#WASM_ram_u8; #WASM_ram_u16; #WASM_ram_u32;
	
	beforeReceive; afterReceive;
	beforeSend; afterSend;
	
	constructor(connectHost=null, connectPort=null)
	{
		// Initialize WASM
		window._SWASMObj = window._SWASMObj || [];
		this.#id = window._SWASMObj.length+1;
		window._SWASMObj[this.#id] = this;

		if (connectHost && connectPort) {
			this.#connectHost = connectHost;
			this.#connectPort = connectPort;
		}

		this.#WASMInit();
		return this;
	}
	
	/** PUBLIC **/
	
	connect(connectHost=null, connectPort=null)
	{
		if (!connectHost && !this.#connectHost) {
			console.error(`SocketWASM Error: Unable to connect, there's no host specified`);
			return false;
		}
		
		if (!connectPort && !this.#connectPort) {
			console.error(`SocketWASM Error: Unable to connect, there's no port specified`);
			return false;
		}

		// Connect
		this.#connectHost = connectHost || this.#connectHost;
		this.#connectPort = connectPort || this.#connectPort;
		this.#WASMconnect(this.#connectHost, this.#connectPort);
		
		return this;
	}
	
	send(data)
	{
		if (!!this.#connected)
			return false;
		
		this.#WASMSendBefore(data);
		this.#WASMSend(data);
		this.#WASMSendAfter(data);
	}
	
	isConnected() { return !!this.#connected; }
	
	tick() { this.#WASM_exports.tick(); }
	readString(addr) { this.#readString(this.#WASM_ram_u8, addr); }
	getBuffer() { return this.#WASM_ram_u8; }
	
	/** PRIVATE **/
	
	async #WASMInit()
	{
		this.#WASM_obj = {
			imports: {},
			env: {
				// Emscripten.h
				emscripten_get_sbrk_ptr: 		(()=>{}),
				emscripten_asm_const_int: 	(()=>{}),
				emscripten_run_script: 			(()=>{}),
				__stack_pointer: 						new WebAssembly.Global({value:'i32', mutable:true}, 0),
				__memory_base: 							1,
				__table_base: 							0,
				__indirect_function_table: 	new WebAssembly.Table({ initial: 1, element: 'anyfunc' }),
				table: 											new WebAssembly.Table({ initial: 1, element: 'anyfunc' }),
				memoryBase: 								0,
				memory: 										new WebAssembly.Memory({initial: 512, maximum: 0x10000}),
				
				// Stdio
				segfault: 									(()=>{}),
				__syscall: 									(()=>{}),
				__syscall1: 								(()=>{}),
				__syscall2: 								(()=>{}),
				__syscall3: 								(()=>{}),
				__syscall4: 								(()=>{}),
				__syscall5: 								(()=>{}),
				__syscall6: 								(()=>{}),
				__syscall7: 								(()=>{}),
				__syscall8: 								(()=>{}),
				malloc: 										(()=>{}),
				puts: 											(()=>{}),
				iprintf: 										(()=>{}),
				
				// Socket.h
				socket: 										(()=>{}),
				htons: 											(()=>{}),
				inet_pton: 									(()=>{}),
				gethostbyname: 							(()=>{}),
				connect: 										(()=>{})
			}
		};
	
		(async () => {
			const codePromise = fetch('bin/loadwasm.php');
			const { instance } = window.instance = await WebAssembly.instantiateStreaming(codePromise, this.#WASM_obj);
			const buffer = window.buffer = instance.exports.memory.buffer;
			
			this.#WASM_ram_u8 = new Uint8Array(buffer);
			this.#WASM_ram_u16 = new Uint16Array(buffer);
			this.#WASM_ram_u32 = new Uint32Array(buffer);
			
			this.#WASM_exports = instance.exports;
			var main_rtn = this.#WASM_exports.main(); console.log(`Main returned: ${main_rtn}`);
	
			// Connect
			if (this.#connectHost && this.#connectPort)
				this.connect(this.#connectHost, this.#connectPort);

			// Begin main loop
			this.#WASM_timer = setInterval(function() {
				this.#WASM_exports.tick && this.#WASM_exports.tick();
				var eval_addr = this.#WASM_exports.getEvalBufferAddr();

				if (eval_addr)
				{
					var eval_str = this.#readString(this.#WASM_ram_u8, eval_addr);
					this.#freeMem(this.#WASM_ram_u8, eval_addr);
					eval(`(function() { ${eval_str} })
								.bind(window._SWASMObj[${this.#id}]) ()`);
					
				}
			}.bind(this), 1000 / this.#WASM_HZ);
		}).bind(window._SWASMObj[this.#id]) ();
	}

	#writeVal(buf, addr, val)
	{
		// Int
		if (typeof val == 'number')
			buf[addr] = val;

		// String
		else if (typeof val == 'string')
		{
			for (var i=0; i<addr+val.length; i++)
				buf[addr+i] = val.charCodeAt(i);
			
			if (buf[i+1]) buf[i+1] = 0;
		}
	}

	#readInt(buf, addr)
	{
		return buf[addr];
	}

	#readString(buf, addr)
	{
		var rtn = '';
			
			for (var i=addr; buf[i]; i++)
				rtn += String.fromCharCode(buf[i]);
				
			return rtn;
	}
	
	#freeMem(buf, addr, maxLen=null)
	{
		for (var i=addr, c=0; (maxLen && c<maxLen) || buf[i]; i++, c++)
			buf[i] = 0x00;
	}
	
	#WASMDisconnect()
	{
		// Todo: Disconnect with WASM
		
		this.#connected = false;
		return true;
	}
	
	#WASMconnect(connectHost, connectPort)
	{
		this.#writeVal(this.#WASM_ram_u8, this.#WASM_exports.getHostAddr(), connectHost);
		this.#writeVal(this.#WASM_ram_u8, this.#WASM_exports.getPortAddr(), connectPort);

		var connect_rtn = this.#WASM_exports.WasmConnect();
		
		if (connect_rtn) {
			console.error(`SocketWASM Error: Unable to connect to ${this.#connectHost}:${this.#connectPort}`);
			return false;
		}
		
		return true;
	}
	
	#WASMReceiveBefore()
	{
		if (typeof this.beforeReceive === 'function')
			this.beforeReceive();
		
		return true;
	}
	
	#WASMReceiveAfter(data)
	{
		if (typeof this.afterReceive === 'function')
			this.afterReceive(data);
		
		return true;
	}
	
	#WASMSend(data)
	{
		// Todo: Send with WASM;
	}
	
	#WASMSendBefore(data)
	{
		if (typeof this.beforeSend === 'function')
			this.beforeSend(data);
		
		return true;
	}
	
	#WASMSendAfter(data=null)
	{
		if (typeof this.afterSend === 'function')
			this.afterSend(data);
		
		return true;
	}
}

// Test Run
console.log("TEST A:\n");
var a = new SocketWASM('127.0.0.1', 9001);
