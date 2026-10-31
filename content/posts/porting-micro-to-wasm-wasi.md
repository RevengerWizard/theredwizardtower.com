+++
date = '2026-10-30T21:01:55+02:00'
draft = true
title = 'Porting micro to WASM + WASI'
tags = ['c', 'teascript', 'micro', 'wasm', 'wasi']
+++

I've been experimenting with WASM a few times before.
Getting normal C projects compiling under WASM has always been rather finnicky. For once, gcc and clang do not support WASM as a main target out of the box, you're therefore forced to find another way to reach your desired output. One pretty popular way to get your C and C++ to cleanly compile to WASM is through [emscripten](emscripten.org/).

Emscripten allows you to compile your C projects into WASM by using the powers of LLVM. It also comprises a set of Javascript functions and glue for managing the resulting WASM, as well as even being able to write JS functions directly into your C files.
Now, this is what I've been using and trying for a few times before.

My first exposure compiling to WASM has been by attempting to make a minimal web running version for my [Teascript](teascript.org/) interpreter. The project structure is pretty straightforward, comprising a list of C files all under a `src/` directory.
Emscripten is used through the command line program `emcc`, which has options matching those of gcc and clang.
Each input C file is first compiled into an object file, just as it's usually the case, but since our desired target is WASM, these will actually also contain WASM code! The final `tea.wasm` or static library `libtea.a` will then be created by giving the Emscripten linker program all the generated object files.
Here's what the `emscripten.make` file used to compile Teascript into WASM looked like:

```make
# A simple Makefile to quickly compile Teascript src/ into libtea.a
# Definitely going to change in the future

emscripten:
	$(MAKE) "CC=emcc" "TARGET_AR=emar rcu" "TARGET_STRIP=:" \
	"XCFLAGS=-DTEA_OS=TEA_OS_OTHER -DTEA_TARGET=1" \
	"CCOPT=-Os" "LDFLAGS=-Os" \
	"BUILDMODE=static" \
	"TEA_T=tea.js" all
```

In this case, the final file was `libtea.a`, a WASM static library containing the whole interpreter runtime.
Why not directly compile as a `tea.wasm` file and use that directly?
Well, the reason is in how WASM itself communicates with the browser. To do anything useful with our WASM module, it has to be first fetched and streamed to us by the browser. To do anything useful, our WASM also has to communicate with the outside, mainly by displaying text to an HTML element.
All of these actions and more is achieved through Javascript, which exposes a `WebAssembly` object.
Emscripten facilitates most of this project, by also generating for us a `.js` file containing everything that's needed to load our WASM into the browser. 

However, for the sake of knowledge and understanding more about the process as a whole, I'll provide the nitty details to do everything ourselves.
For example, to instantiate our WASM file manually, we could do the following:

```js
const result = await WebAssembly.instantiateStreaming(response, imports).catch(async () => WebAssembly.instantiate(await (await fetch("index.wasm")).arrayBuffer(), imports));
```

`imports` is an object with properties allowing us to customize the functions contained and imported by our `index.wasm` module. The snippet above also handles the case for some servers which may not be able to use `instantiateStreaming`, and defaults to the much older function `instantiate` + a `fetch`.
The `result` will be an object with a `result.instance` property that represents our WASM module. It also provides to us the property `exports`, which are all the public C functions exported by our WASM module after compilation.

All of this is handled directly for us by Emscripten through the object `Module`.

How exactly do we print text "to the screen" now?
Our C code uses `printf`, `fwrite`, `puts` and friends, outputting text to `stdout` or `stderr`, but these do not really exist in the browser. The closest to these functions in the browser are `console.log` and `console.error`, which print text to the Inspect console.
Well, for a very long time this has been the main issue when working with WASM in any capacity. Our module is effectively sandboxed from anything accessible directly through the browser. Something interesting we can do through WASM, however, is call Javascript functions.

That's right, Javascript functions called through our WASM!
Emscripten provides a set of Javascript functions inside its `Module` object that we can override to achieve whatever we want. For instance, `print` is called by any C function that interacts with `stdout`, while `printErr` is used for errors, called when we use `stderr`. Pretty straightforward one would say:

```js
var Module = {
    print: function(text) {
        if(arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
        console.log(text);
    },
	printErr: function(text) {
		if(arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
		console.error(text);
	}
};
```

So far, so good. We can print text to the browser console, or through an HTML element if we'd like to.
These are exclusively provided to us by the Emscripten Javascript glue, the generated `.js` file.

To make the interpreter communicate with the browser, I had a small C file exposing three functions:
- `new_state`, for creating and storing a newly created `tea_State`;
- `free_state`, for closing the previously created `tea_State`;
- `run_tea`, for running a string of Teascript code;

These three C functions were then loaded through Emscripten using the following mechanism:

```js
var run_tea, new_state, free_state;

Module['onRuntimeInitialized'] = function() {
	create_state = Module.cwrap('new_state', null, []);
	free_state = Module.cwrap('free_state', null, []);
	run_tea = Module.cwrap('run_tea', null, ['string']);

	create_state();
};

window.onbeforeunload = function() {
	free_state();
};
```

The state is then freed once the tab is closed through `window.onbeforeunload`.
Letting the Javascript interact directly with the WASM layer turns out to be pretty cumbersome and weird, since we need to convert JS values to WASM primitives and vice-versa. It's therefore much easier to have a small C glue file to manage directly through functions.

How would somebody manage all of this without Emscripten itself?

WASM isn't just used in the browser. Since it first appearance in 2017, the language has had a big focus in regards to security and verifiability. And, if you've ever worked with binary formats, you'd know that it's not exactly trivial to make sure that the binary created or consumed is safe to be loaded by an application. This is especially critical in a browser environment, where everything is loaded from the Internet.
These characteristics made WebAssembly an attractive choice to be used also in native context, outside a browser. It's effectively portable assembly code.
To run WASM outside a browser one can use some of the runtimes available, such as wasmer or wasmtime.

Circling back, the same issue we had in the browser still poses in a native environment.
How do let WASM comunicate with the operating system? Handling IO, reading environment variables, reading and writing files, and much more? This is where WASI comes into play.

WASI, WebAssembly System Interface, is a group of standard API specifications, and as described in its [website](wasi.dev/):

> WASI is designed to provide a secure standard interface for applications that can be compiled to Wasm from any language, and that may run anywhere, from browsers to clouds to embedded devices.

Before WASI being introduced, each runtime would have had to decide a set of functions for letting WASM interact with the host, thus hindering the portability of WASM.
The advantage in WASI is that now we have a set of API functions that we are guaranteed will be implemented by the runtime we want to run on, and as WASM itself they're also defined such that they can be safely sandboxed by the runtime.

I like to think of these functions as the _syscalls_ for WebAssembly.

So, what about displaying to `stdout` and `stderr` now that we can use WASM + WASI? Well, WASI defines one API function for handling this:
- `fd_write(fd, iovs, iovsLen, nwrittenPtr)`

Where `fd` is the _file descriptor_, which is just an integer acting as the file handle.
If `fd === 1`, then it represents `stdout`.
If `fd === 2`, then it represents `stderr`.
If `fd` is anything else, then it's a normal (accessible) file.

That is great! We have a single standard function that will handle the displaying of text to the console.

But, wait a second... What about the browser? After all, we are trying to run our WASM in the browser.
The short answer is, even if you're able to target this new WASI API target, no browser currently implements anything of such API at all. Bumper. That would have been too good to be true, right?

We are still constrained to using Javascript glue code for the foreseeable future.

Up until this point, I've been using Emscripten to compile the C code of my Teascript interpreter into WASM. However, personally I'm not quite satisfied with this solution. For once, I'm forced to use a separate compiler, although it's still effectively LLVM. What I'd like instead, would be to use normal clang to also manage a WASM target.
Much more importantly, is the fact that the original C source code should remain entirely unchanged. This means that I do not want to introduce any particular special handling for WASM. Naturally, the minimum was to define some macros for its target. And so should other C libraries.
This includes having to define any kind of separate, exclusive C function to be exposed to WASM.

Thanks to the introduction of WASI, a new toolchain is now available to let clang work with WASM as a target, [WASI SDK](https://github.com/WebAssembly/wasi-sdk). It's composed of two pieces, the main SDK and [WASI libc](https://github.com/WebAssembly/wasi-libc), implementing the C standard library (for the most part?).

This has been so far for me a fairly recent discovery. In fact, I haven't really modified my original WASM Teascript utilizing Emscripten, so I wanted to see whether using this SDK could turn out to be nicer.
After installing the necessary packages, I like to use MSYS2 on Windows, I can now just use `clang --target=wasm32-wasip1`, as well as providing the necessary `--sysroot` for the SDK. Each C source file is still compiled to a WASM object file, and then all linked either into a `libtea-wasm.a` static library or `tea.wasm` WASM module.

Now that we have our static library, we can create our WebAssembly module through Javascript's `WebAssembly.instantiateStreaming`, passing in our now desired imports. Since the target provided to clang WASM32 using the WASI Preview 1, all the WASI functions utilized by our program will be available through the field `wasi_snapshot_preview1`. The standard is ever changing, and Preview 1 is already set to be deprecated.

Here is how you may override the WASI in the Javascript imports object:

```js
const imports = { wasi_snapshot_preview1: wasi }
```

Where `wasi` is our object of WASI functions written in Javascript, to interact with the browser. From here on, we can fill in all the WASI functions that we may need, or add stubs for others. One such example, although just a shim, is [this one](github.com/bjorn3/browser_wasi_shim).

Back in our [previous post](posts/chronicles-of-the-lost-pixel-framework), I exposed a bit of "history" about my micro pixel framework, if one may call it that.
It's another fairly small and boring C project, embedding Teascript for scripting inside the framework.

I always loved that PICO-8 let you play carts directly in the browser, through small PNG files.
Naturally, our pixel framework game won't easily fit in a single PNG; the current way to now distribute a game written for micro using Teascript is by turning a whole project into a ZIP file called `pak0`, and having such file being present in the same directory as the `micro` executable and its dynamic libraries:

```text
pak0
micro.exe
tea00.dll
glfw3.dll
glew32.dll
```

I suppose it's a fairly reasonable option if somebody wants to distribute the game.
But what about the browser? It would be really nice to have our nice little pixel framework running exactly as it is through the browser!

Well, for starters, we have to look at the dependencies that micro requires to build. Right now, the most important ones are:
- OpenGL
- GLEW
- GLFW
- miniaudio

This is a bit tricky. Let's analyze for a moment the requirements.
Firstly, OpenGL can be easily converted to the browser's WebGL API, mirroring it exactly. GLEW, however, that is mainly used to load the OpenGL function pointers and extensions that micro needs to run. This isn't really required for our browser port, since all we need is already present in the WebGL context the browser will hand us. For keeping things simple we'll just assume that the browser already handles all the OpenGL API functions we need. We can just disable GLEW's `glewInit` function from running.

There's then GLFW, for managing the window, input and main loop of the program.
This covers a much larger range of functions that we use throughout the codebase. How do we manage this? Well, the solution I came up with, which is the same one used to manage the C OpenGL functions we use, is to provide the WASM build process with _stub_ functions for both GLFW and GL.
I did try to just compile using the packaged `glfw3.h` headers, but an infinite stream of compiler error text fills my terminal console forever. I'm thinking that might be caused by the `glfw3native.h` header used by GLFW, which would never work or even compile for a WASM target.
It would have definitely be nicer if the GLFW header files had some macro checks already present for handling just a stub in case of a WASM target. But for now, it's easier to just put these stub files:

```text
stub/
    GL/
        gl.h
        glcorearb.h
    GLFW
        glfw3.h
```

and pointing the compiler include paths through the `-I` option. Fair enough, I suppose.

There's finally miniaudio. I still haven't come around handling miniaudio. It's a huge 90k lines C header file and I don't really have the time to take a look and handle all its functions for WASM. The audio in the browser can be handled through the WebAudio API, although I still haven't looked at it in depth. For the moment, I just exclude the audio side behind a `MICRO_NO_AUDIO` define I set in the build process.

There is, however, something we may have forgotten.
What about the main loop of the game? This was handled in the `main` function and implemented through a busy `while` loop by calling a step function, driven as long as GLFW says the window is open.
On each frame, the loop calls the core Teascript functions for managing input polling, delta time calculations and the graphics. All the functionality is managed by a set of Teascript file, embedded inside the program during compilation.
Once the Teascript side has been executed, we then calculate the wait for the next frame and sleep for the remaining time, if present. Finally, when the loop ends, the Teascript interpreter, GLFW, audio and buffers are all freed.

If you try to run an infinite loop through Javascript in the browser you'll quickly notice the browser tab freeze. Javascript by its nature runs in a single thread, so running an infinite loop effectively blocks everything inside the browser tab from working. If you had to stand and wait for a fetch request for example without doing anything else in the meantime, you'd be losing a lot of time.
That is why Javascript handles these issues _asynchronously_. It's effectively just a event loop you subscribe to. When you `fetch`, you'd pass a callback for when the request succedes and also in case of failure. You'd then keep executing Javascript code as nothing happened, since the request may need even seconds to reach our browser client. Once the request has been satisfied, the success callback we gave to the `fetch` will run and we'll be able to handle or display its data.

There are two options here
- asyncify the main loop function
- use `requestAnimationFrame`

I've decided for now to use the second option. How this works is that we can pass this function a callback, which will be called by the browser continously each animation drawing frame.
And, here I may contradict myself with what I've been writing about in the first part of this post, which is keeping the C source code with almost no modifications. I took my `main` entry function and re-organized a bit the main framework loop functions that we used, exposing them to the outside for use. These are:

- `micro_open` for managing the opening of the Teascript state, loading of the core Tea files and command arguments;
- `spxeStep` kept as it is and just exposed, managing the OpenGL texture drawing and telling the program when to end with GLFW;
- `micro_run` to run the Teascript framework and game logic;
- `micro_close` for finally closing and freeing everything we used.

As it was done for the WASM Teascript interpreter, a small C glue file is finally used to actually handle everything through Javascript easily:

- `micro_wasm_open`
- `micro_wasm_frame`
- `micro_wasm_close`

as well as crafting the `argv` and `argc` arguments passed to the program. This is just `micro`.

You may notice that we actually do not use the `main` original function. It basically remains the same, with no modifications besides containing the original logic into these separate functions that we can use through WASM; so, actually nothing much has changed :D

We build the whole C project using `clang --target=wasm32-wasip1` and use the resulting `libmicro-wasm.a` static library together with our C glue code to finally build the final `micro.wasm` WASM module.
That is the whole compilation process, using just clang with WASM + WASI target.

That is however just the first part of the building. What happened to all the OpenGL and GLFW functions we used in our original program? Well, they're undefined function references basically, and nothing as yet been managed.
What we now need is to write all these functions in Javascript to communicate with the browser.
Thankfully, these [Github](https://github.com/easywasm) repositories easywasm helped a great deal managing this part of the process. I'll save you another paragraph and show you the final Javascript `imports` object, filled with all the Javascript functions called by our WASM module:

```js
const imports = { env, glfw, glew: glImports.glew, opengl: glImports.opengl, wasi_snapshot_preview1: wasi }
```

- `env` has some C functions that we need to patch, mainly `clock` and `system`; there's probably another way but as it is now `clock` actually doesn't work in the browser and `system` of course is useless here.
- `glfw` is the object containing all the GLFW C functions and mapping to the browser input callbacks, `glfwInit`, `glfwTerminate`, etc...
- `opengl` is the object containing all the OpenGL C functions mapped to WebGL, `glCreateProgram`, `glGenBuffers`, etc...
- `wasi` implements the WASI "syscalls" our WASM turns out to call.

Since these browser do not yet implement anything about the WASI API, we'll have to do it ourselves.
Teascript's `import` system needs to resolve paths to find the Teascript files the game needs. But, we're living inside the browser, there's actually no file system or paths that our WASI API functions can use.
To do this final part, we can implement a little _virtual filesystem_ inside the browser, still through Javascript! This is also thanks to [easywasm's WASI implementation](https://github.com/easywasm/wasi), which allows us to provide the WASI `WasiPreview1` object with a ZIP-backed filesystem. It's just a Javascript object (class) which handles the WASI path functions WASM calls. In our case, `readFileSync`, `statSync` and `readdirSync` is enough. We call such virtual file system `PakFS` and its only file accessed is the `pak0` ZIP file that we fetch and expect to be present in the same place of everything else of this port.

The graphics are then displayed through an HTML canvas using WebGL, also used to emulate GLFW functions (input, mouse, keyboard, window).

You can check the final result [here](https://revengerwizard.github.io/micro-wasm/). This runs micro with a small game written in it (with Teascript). The handling is certainly not perfect and some parts need refining, but this provides a working demo of the whole pixel framework directly in your browser of choise; granted, it implements everything we expected so far.
