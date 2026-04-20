+++
date = '2026-04-17T21:01:55+02:00'
draft = false
title = 'Chronicles of the lost pixel framework'
tags = ['c', 'viper', 'teascript', 'micro']
+++

So, this story requires a bit of context.

It all started in 2022. Back then, I had been fiddling from time to time with PICO-8, the fantasy console. PICO-8 is a pretty awesome and charming little framework to create retro games in a resolution of 128x128 pixels.

Giving the user what's basically just a grid of pixels and let them manipulate each single pixel individually interested me since I first bought PICO-8. However, while I find fantasy consoles like PICO-8 and the limitations they impose a nice way to channel creativity, I personally find the "specs" overall a bit too narrow.

It'd be nicer to have a simple pixel framework where you can decide the dimensions of you pixel screen, and it'd be up to you to draw inside of it pixel by pixel! The rest, input, audio, fonts, images, you're free to use most of what your OS gives you. You can of course achieve such an effect using other 2d frameworks, like Love2d, by creating a canvas and scale it to the whole screen. But, it takes much more effort and settings to reach the desidered effect. 

It seemed like I wasn't the first (or the last) to think of such a framework. In fact, rxi preceeded me by about 10 years! Well, it isn't such an original idea to begin with, but it's nice that there's some ground to stand on. When browsing through [rxi's](https://github.com/rxi) Github repositories, I discovered [juno](https://github.com/rxi/juno).

Juno is a very simple framework for making 2d games with chunky pixels, using Lua. By its simple API design, it's similar to Love2D, which also uses Lua.  
Everything in the framework is accessible by the global variable `juno`, which exposes many useful sub-modules:

- `juno.Font` -- used to load and render fonts
- `juno.Buffer` -- handle buffers
- `juno.Source` -- handle sound sources
- `juno.Data` -- load and handle raw binary data
- `juno.Gif` -- can be used to record and save the screen as a GIF
- `juno.system` -- handle events and retrieve OS informations (appdata, name, exe directory)
- `juno.fs` -- exposes a simple filesystem of mounted directories
- `juno.time` -- getting time
- `juno.graphics` -- draw pixels and buffers
- `juno.audio` -- init and use master audio source
- `juno.mouse` -- mouse presses and events
- `juno.keyboard` -- keyboard presses and events
- `juno.bufferfx` -- handle buffer effects (blur, mask, palette, wave, etc)

Everything you draw onto the screen is a "buffer" of pixels, even the screen itself, which is accessible by `juno.graphics.screen` is a buffer. You can draw pixels, circles, rectangles, lines, blend colors, clear, copy pixels, and much more with buffers.

The 3 most important functions of every self respecting game loop are: `load`, `update` and `draw`. `juno.load` is the function called at startup. `juno.update` and `juno.draw` are the main loop of the program; they're effectively called every frame. `juno.update(dt)` takes as argument `dt`, delta-time, which is a constant used to synchronize actions and movement in game to the frame-rate of the screen. You may put in `update` only game logic code, like player movement, enemy movement, and so on. `juno.draw`, then, should only be used to effectively call the framework functions to draw on the screen. Pretty straightforward.

By the GIF present in the repository README, it seemed like there were some games made by rxi using Juno. It turned out a bit hard to find these games; fortunately, thanks to the powers of Archive.org and an [issue](https://github.com/rxi/juno/issues/1) with the same question.

The original Juno uses SDL1, which at this time results deprecated. I then decided to basically re-work rxi's Juno to use the much newer SDL2, instead of the old SDL1. It turned out, during the transition from SDL1 to SDL2, a lot of the APIs changed and got improved; you could no longer just init SDL and call `SDL_GetVideoSurface` to get the screen pixel surface, but rather:

1. create a new window with `SDL_CreateWindow`
2. create a renderer with `SDL_CreateRenderer` by associating the newly created window
3. create a texture with `SDL_CreateTexture`, which is associated to the newly created renderer

In the main loop you can then call `SDL_LockTexture` to grab the raw pixel data, unlock it, and present the SDL renderer with the newly updated texture by calling `SDL_RenderCopy` and `SDL_RenderPresent`. In the end, it's a bit more work but it's more explicit with the handling of resources you're given.

This final version of Juno using SDL2 has some small details which differ from the original rxi framework, mainly renaming some of the sub-modules and API functions. Using SDL2 just to basically create a texture and update it in a loop is a bit too overkill. And SDL itself is a pretty pretty heavy dependency; it has a fully fledge software renderer. I'm tempted to say it's a bit bloated.

It was clear that I had to get rid of SDL _entirely_.

## A new scripting language

By the time I finished re-implementing my own version of Juno, I had a fairly stable version of my little programming language Teascript. Thus, the next step seemed pretty obvious, which was re-writing from scratch my updated Juno version to use Teascript as its scripting language instead of Lua.

Was it practical, or even useful? No, not at all, but it's been pretty fun!

## Another re-write

Instead of having to deal with SDL2, which in the case of such a small graphical program, I decided to switch and use raw OpenGL + GLEW, GLFW to handle window creation and events, and miniaudio for the audio.

Time went by, and at some point I decided to try and write a compiler for a statically compiled language similar to C; I called it Viper. Currently, Viper handles correctly compilation to Windows COFF object files, as well as emitting ABI compatible x64 machine code for Windows. There's the usual stuff you to expect from a relatively simple compiled language:

- functions, using the keyword `fn`
- local and global variables, using `var` or `let`
- integers (`uint32`, `int64`, `uint8`, etc)
- floats (`float32`, `float64`)
- `bool`
- pointers, arrays, structs and unions
- a very very basic standard library

Following the ABI of the target OS effectively allows us to be ABI compatible with C. This is an important point that will come up later on.

At this point you may notice a pattern.

It was clear that the next step was to re-write the whole pixel framework using Viper! It's actually harder than it seems, very very hard, because we're basically starting from zero. There is virtually no standard library except the few functions I was able to write, and we can no longer use any C libraries directly.  
The main graphics dependencies are still OpenGL and GLFW.

First up, GLFW. In C we access its API functions through the C header `glfw3.h`. This header only defines the function prototypes; the code for functions is actually inside the `glfw3.dll` shared library. Since Viper functions follow the same ABI as C, which in turn is the same for the target operating system, it's as simple as implementing the function prototypes in Viper and making sure the types of the parameters are the same as in C. For simplicity, and considering we're on Windows:

- `char` -> `uint8`
- `int`/`long` -> `int32`
- `short` -> `int16`
- `long long` -> `int64`
- `bool` -> `bool`

```vp
pub extern fn glfwCreateWindow(width : int32, height : int32, title : const uint8*, monitor : GLFWmonitor*?, share : GLFWwindow*?) : GLFWwindow*;
```

OpenGL on Windows is provided by a system DLL named `opengl32.dll`. What we can do is effectively create a file [`gl.vp`](https://github.com/RevengerWizard/viper/blob/master/gl.vp). which will contain all OpenGL types and function signatures. We cannot implement the function prototypes directly, because many OpenGL functions may be extensions or very new, and depending on your graphics card they may not be present or implemented.
Actually, `opengl32.dll` guarantees that OpenGL 1.0 functions will be present.  
We can then recover the Win32 GDI function `wglGetProcAddress`, using `GetProcAddress`. Again, this function may not be present, so we need to dynamically load it from the DLL. Using `wglGetProcAddress` we can finally retrieve every OpenGL function we need to use.

```vp
from glfw3 import *
from gl import *
from windows import *
// ...

var glEnable : GLENABLE = nil;
// ...

fn glload() : bool
{
    let wglGetProcAddress : WGLGETPROCADDRESS = ptrcast(WGLGETPROCADDRESS, GetProcAddress(GetModuleHandleA("opengl32"), "wglGetProcAddress"));
    if wglGetProcAddress == nil return false;
    glEnable = wglGetProcAddress("glEnable"); if glEnable == nil return false;
    // ...
}
```
