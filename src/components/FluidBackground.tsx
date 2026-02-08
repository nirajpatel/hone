import { useEffect, useRef } from 'react';

export function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not available');
      return;
    }

    // Set canvas size
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      return { w, h };
    };

    let { w, h } = resize();

    // Simple vertex shader
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
      }
    `;

    // Fragment shader with fluid simulation (velocity + advection + gravity + turbulence)
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform sampler2D u_previous;
      varying vec2 v_texCoord;
      
      // Enhanced noise function with multiple octaves for organic variation
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      // Multi-octave noise for richer organic patterns (fixed 3 octaves)
      float fbmNoise(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        // Fixed 3 octaves - unrolled for GLSL compatibility
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        value += amplitude * noise(p * frequency);
        return value;
      }
      
      // Enhanced turbulence function with more organic, liquid-like variation
      vec2 turbulence(vec2 p) {
        // Multiple scales of noise for organic flow
        float n1 = noise(p * 5.5);
        float n2 = noise(p * 11.0 + vec2(3.7, 5.3));
        float n3 = noise(p * 18.0 + vec2(7.1, 11.2));
        float n4 = noise(p * 32.0 + vec2(13.5, 19.7));
        float n5 = noise(p * 50.0 + vec2(21.3, 29.1));
        
        // Create more organic, varied turbulence with smoother transitions
        vec2 turb = vec2(n1 - 0.5, n2 - 0.5) * 0.02;
        turb += vec2(n2 - 0.5, n3 - 0.5) * 0.014;
        turb += vec2(n3 - 0.5, n4 - 0.5) * 0.008;
        turb += vec2(n4 - 0.5, n5 - 0.5) * 0.004;
        
        // Add rotational component for more organic swirl
        float rot = (n1 - 0.5) * 0.012;
        turb += vec2(-turb.y * rot, turb.x * rot);
        
        // Add wave-like component for more liquid-like flow
        float wave = sin(p.x * 8.0 + p.y * 6.0) * 0.003;
        turb += vec2(wave, wave * 0.7);
        
        return turb;
      }
      
      // Enhanced curl noise with multiple octaves for organic swirling
      vec2 curlNoise(vec2 p, float scale) {
        float e = 0.008;
        // Sample at multiple scales for more organic patterns
        float n1 = fbmNoise((p + vec2(e, 0.0)) * scale);
        float n2 = fbmNoise((p + vec2(0.0, e)) * scale);
        float n3 = fbmNoise((p - vec2(e, 0.0)) * scale);
        float n4 = fbmNoise((p - vec2(0.0, e)) * scale);
        float dx = (n1 - n3) / (2.0 * e);
        float dy = (n2 - n4) / (2.0 * e);
        return vec2(-dy, dx) * 0.025;
      }
      
      void main() {
        vec2 coord = v_texCoord;
        vec2 mouse = u_mouse / u_resolution;
        vec2 pixelSize = 1.0 / u_resolution;
        
        // Sample previous frame to get density and velocity
        vec4 prev = texture2D(u_previous, coord);
        float prevDensity = prev.r;
        vec2 prevVelocity = (prev.gb - 0.5) * 2.0; // Velocity stored in green/blue channels
        
        // Add multi-scale turbulence and curl for organic flow (always active)
        vec2 turb = turbulence(coord);
        
        // Multiple scales of curl noise for organic swirling patterns
        vec2 curlFine = curlNoise(coord, 4.5);
        vec2 curlMedium = curlNoise(coord, 1.8) * 0.65;
        vec2 curlLarge = curlNoise(coord, 0.5) * 0.45;
        vec2 curlVeryLarge = curlNoise(coord, 0.15) * 0.25;
        
        // Combine curl scales for organic, varied swirling with liquid-like flow
        vec2 curl = curlFine + curlMedium + curlLarge + curlVeryLarge;
        
        // Calculate velocity from mouse movement (swirl effect)
        vec2 mouseDist = coord - mouse;
        float mouseDistLen = length(mouseDist);
        vec2 velocity = prevVelocity; // Start with previous velocity for continuity
        
        if (mouseDistLen < 0.35 && u_mouse.x > 0.0 && u_mouse.y > 0.0) {
          // Create organic, varied swirl around mouse (like stirring coffee)
          vec2 tangent = vec2(-mouseDist.y, mouseDist.x) / max(mouseDistLen, 0.001);
          float swirlStrength = smoothstep(0.35, 0.0, mouseDistLen);
          
          // Add organic variation to swirl strength
          float swirlVariation = noise(coord * 8.0 + vec2(2.3, 4.7)) * 0.3 + 0.7;
          float swirlSpeed = 1.3 * swirlVariation;
          
          // Create more organic, asymmetric swirl pattern
          vec2 organicTangent = tangent;
          // Add slight radial component for more organic mixing
          float radialComponent = noise(coord * 12.0) * 0.15;
          organicTangent += mouseDist * radialComponent * 0.2;
          
          velocity += organicTangent * swirlSpeed * swirlStrength;
          
          // Pull density toward mouse with organic variation (creates natural mixing)
          float pullVariation = noise(coord * 10.0) * 0.2 + 0.8;
          velocity -= mouseDist * 0.38 * swirlStrength * pullVariation;
        }
        
        // Add gravity (downward velocity) - milk sinks and flows naturally
        velocity.y += 0.0015 * (1.0 + prevDensity * 0.3);
        
        // Enhanced turbulence and curl for more organic, liquid-like flow
        // Density-dependent strength for more organic response
        float densityFactor = 0.5 + prevDensity * 0.5;
        // More pronounced turbulence in denser areas for natural liquid mixing
        velocity += turb * (0.65 + prevDensity * 0.45) * densityFactor;
        velocity += curl * (0.58 + prevDensity * 0.4) * densityFactor;
        
        // Add smooth, organic velocity variation based on density gradients
        vec2 densityGrad = vec2(
          texture2D(u_previous, coord + vec2(pixelSize.x, 0.0)).r - texture2D(u_previous, coord - vec2(pixelSize.x, 0.0)).r,
          texture2D(u_previous, coord + vec2(0.0, pixelSize.y)).r - texture2D(u_previous, coord - vec2(0.0, pixelSize.y)).r
        ) * 0.5;
        // Natural flow along density gradients (like liquid flowing)
        velocity += densityGrad * 0.2; // Increased for more liquid-like flow
        
        // Add organic, varying rotational flow patterns (vortices)
        // Use noise to create organic, shifting vortex centers
        float time = 0.0; // Could use u_time if needed, but works without
        vec2 center1 = vec2(0.3 + noise(coord * 0.3) * 0.1, 0.4 + noise(coord * 0.3 + vec2(1.0)) * 0.1);
        vec2 center2 = vec2(0.7 + noise(coord * 0.25 + vec2(2.0)) * 0.1, 0.5 + noise(coord * 0.25 + vec2(3.0)) * 0.1);
        vec2 center3 = vec2(0.5 + noise(coord * 0.35 + vec2(4.0)) * 0.12, 0.6 + noise(coord * 0.35 + vec2(5.0)) * 0.12);
        
        for (int i = 0; i < 3; i++) {
          vec2 center = (i == 0) ? center1 : ((i == 1) ? center2 : center3);
          vec2 dist = coord - center;
          float distLen = length(dist);
          
          // Varying vortex sizes for organic feel
          float vortexSize = (i == 0) ? 0.45 : ((i == 1) ? 0.42 : 0.48);
          if (distLen < vortexSize) {
            vec2 tangent = vec2(-dist.y, dist.x) / max(distLen, 0.001);
            
            // Organic strength variation
            float strengthVariation = noise(coord * 5.0 + vec2(float(i) * 3.0)) * 0.3 + 0.7;
            float strength = smoothstep(vortexSize, 0.0, distLen) * 0.12 * strengthVariation; // Balanced strength
            
            // Add slight radial component for more organic mixing
            float radialMix = noise(coord * 7.0 + vec2(float(i) * 2.5)) * 0.1;
            tangent += dist * radialMix * 0.15;
            
            velocity += tangent * strength;
          }
        }
        
        // Apply viscosity/damping (liquid = lower viscosity for smoother flow)
        velocity *= 0.98; // Less damping = more fluid, liquid-like movement
        
        // Advection - move density with velocity (semi-Lagrangian)
        // Larger step size for smoother, more liquid-like flow
        vec2 advectCoord = coord - velocity * pixelSize * 6.0;
        advectCoord = clamp(advectCoord, 0.001, 0.999);
        float advectedDensity = texture2D(u_previous, advectCoord).r;
        
        // Start with advected density
        float density = advectedDensity;
        
        // Add density at mouse position (creates milk when stirring)
        // Larger radius and softer for more liquid-like, cloudy appearance
        float mouseDist2 = distance(coord, mouse);
        if (mouseDist2 < 0.25 && u_mouse.x > 0.0 && u_mouse.y > 0.0) {
          float mouseDensity = smoothstep(0.25, 0.0, mouseDist2);
          // Softer organic variation for more liquid-like appearance
          float variation = noise(coord * 10.0) * 0.15;
          float variation2 = noise(coord * 18.0 + vec2(3.0)) * 0.1;
          float variation3 = noise(coord * 28.0 + vec2(7.0)) * 0.06;
          density = max(density, mouseDensity * (0.65 + variation + variation2 + variation3)); // Softer, more liquid-like
        }
        
        // No persistent blobs - only mouse interaction creates milk
        
        // Balanced diffusion for liquid-like but not too cloudy
        float diffusion = 0.0;
        float totalWeight = 0.0;
        // Medium diffusion kernel for smooth liquid blending
        for (int i = -1; i <= 1; i++) {
          for (int j = -1; j <= 1; j++) {
            if (i == 0 && j == 0) continue;
            float weight = 1.0 / (abs(float(i)) + abs(float(j)) + 1.0);
            vec2 diffCoord = coord + vec2(float(i), float(j)) * pixelSize * 2.0;
            diffCoord = clamp(diffCoord, 0.001, 0.999);
            diffusion += texture2D(u_previous, diffCoord).r * weight;
            totalWeight += weight;
          }
        }
        diffusion /= totalWeight;
        density = mix(density, diffusion, 0.12); // Balanced diffusion for liquid-like flow
        
        // Remove density near bottom to prevent accumulation
        float bottomFade = smoothstep(0.95, 0.88, coord.y);
        density *= bottomFade;
        
        // Balanced decay for liquid-like flow without being too cloudy
        // Add slight variation to decay for organic feel
        float decayVariation = 1.0 + (noise(coord * 5.0) - 0.5) * 0.001;
        density *= 0.9955 * decayVariation; // Balanced decay
        density = clamp(density, 0.0, 1.0);
        
        // Store density in red channel, velocity in green/blue channels for next frame
        gl_FragColor = vec4(density, velocity * 0.5 + 0.5, 1.0);
      }
    `;

    const createShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const createProgram = (vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      return program;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fsSource);

    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(vertexShader, fragmentShader);
    if (!program) return;

    // Create copy shader for rendering framebuffer to screen
    const copyVsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
      }
    `;
    
    const copyFsSource = `
      precision highp float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      
      // Simple noise function for texture variation
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      // Multi-octave noise for richer texture
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p * frequency);
          amplitude *= 0.5;
          frequency *= 2.0;
        }
        return value;
      }
      
      void main() {
        // Read density from red channel
        float density = texture2D(u_texture, v_texCoord).r;
        
        // Bright, white milk color - BASE COLOR
        vec3 milk = vec3(0.98, 0.96, 0.94);
        
        // Rich, deep coffee color (vibrant dark brown with warm undertones) - MIXED IN
        vec3 coffee = vec3(0.12, 0.06, 0.03);
        
        // Add dense, granular frothy texture to coffee areas (inverted)
        vec2 texCoord = v_texCoord * 150.0;
        float n1 = noise(texCoord);
        float n2 = noise(texCoord * 2.3 + vec2(7.0));
        float n3 = noise(texCoord * 4.7 + vec2(13.0));
        float n4 = noise(texCoord * 8.1 + vec2(19.0));
        
        // Create dense, granular texture pattern for coffee mixing
        float froth = (n1 * 0.4 + n2 * 0.3 + n3 * 0.2 + n4 * 0.1);
        float textureAmount = smoothstep(0.1, 0.7, density);
        
        // More pronounced texture variation for granular appearance
        float frothVariation = mix(1.0, 0.75 + froth * 0.35, textureAmount);
        
        // Add fine-grained texture using FBM for organic feel
        float fineTexture = fbm(texCoord * 0.8);
        float fineVariation = mix(1.0, 0.88 + fineTexture * 0.24, textureAmount * 0.6);
        
        // Smooth, liquid-like blending - coffee mixing into milk
        // Inverted: low density = milk, high density = coffee
        float mixFactor = smoothstep(0.02, 0.75, density);
        
        // Balanced translucent blending for liquid-like appearance
        // Smooth exponential blending for natural liquid mixing
        float blendAmount = mixFactor * 0.9; // Balanced translucency
        // Add smooth falloff for more natural liquid edges with organic variation
        float smoothBlend = smoothstep(0.0, 1.0, blendAmount);
        // Add subtle organic variation to blending for more natural look
        float blendVariation = 1.0 + (fbm(v_texCoord * 8.0) - 0.5) * 0.1; // Balanced variation
        // Inverted mix: start with milk, add coffee based on density
        vec3 color = mix(milk, coffee, smoothBlend * frothVariation * fineVariation * blendVariation);
        
        // Enhance warm tones in coffee-mixed areas for vibrancy
        float warmTint = mixFactor * 0.4;
        color.r += 0.06 * warmTint;
        color.g += 0.03 * warmTint;
        color.b += 0.01 * warmTint;
        
        // Softer contrast for more liquid-like, flowing appearance
        color = mix(color, color * 0.95, mixFactor * 0.2); // Darken coffee areas slightly
        
        // Enhance saturation in coffee areas for more vibrant liquid look
        float saturationBoost = smoothstep(0.1, 0.9, density) * 0.15;
        vec3 gray = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
        color = mix(gray, color, 1.0 + saturationBoost);
        
        // Add subtle glow to coffee-mixed areas for more liquid-like appearance
        float glow = smoothstep(0.1, 0.65, density) * 0.08;
        color += glow * vec3(0.05, 0.03, 0.02); // Subtle dark glow
        
        // Add subtle rim lighting effect for more 3D liquid appearance
        float rimLight = smoothstep(0.3, 0.7, density) * smoothstep(1.0, 0.5, mixFactor) * 0.05;
        color += rimLight * vec3(0.08, 0.05, 0.03);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    const copyVertexShader = createShader(gl.VERTEX_SHADER, copyVsSource);
    const copyFragmentShader = createShader(gl.FRAGMENT_SHADER, copyFsSource);
    const copyProgram = copyVertexShader && copyFragmentShader ? createProgram(copyVertexShader, copyFragmentShader) : null;
    
    if (!copyProgram) return;

    // Create quad
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    // Create texture and framebuffer for persistence
    const createFBO = (width: number, height: number) => {
      const texture = gl.createTexture();
      if (!texture) return null;
      
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const framebuffer = gl.createFramebuffer();
      if (!framebuffer) return null;
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        return null;
      }

      return { framebuffer, texture };
    };

    // Create two framebuffers for ping-pong
    let fbo1 = createFBO(w, h);
    let fbo2 = createFBO(w, h);
    if (!fbo1 || !fbo2) return;

        // Initialize framebuffers with zero density and zero velocity
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.framebuffer);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0.0, 0.5, 0.5, 1.0); // Zero density, zero velocity
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2.framebuffer);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0.0, 0.5, 0.5, 1.0); // Zero density, zero velocity
        gl.clear(gl.COLOR_BUFFER_BIT);

    // Mouse position (track previous for velocity calculation)
    // Initialize to negative values to indicate no mouse input
    const mouseRef = { x: -1.0, y: -1.0, prevX: -1.0, prevY: -1.0 };

    let frameCount = 0;
    const render = () => {
      frameCount++;
      
      // Ping-pong: read from one, write to the other
      const read = frameCount % 2 === 0 ? fbo1 : fbo2;
      const write = frameCount % 2 === 0 ? fbo2 : fbo1;
      
      // Render to write framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
      gl.viewport(0, 0, w, h);

      gl.useProgram(program);
      
      // Set up vertex attributes
      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      // Set uniforms
      const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
      const mouseLoc = gl.getUniformLocation(program, 'u_mouse');
      const previousLoc = gl.getUniformLocation(program, 'u_previous');
      
      if (resolutionLoc) gl.uniform2f(resolutionLoc, w, h);
      if (mouseLoc) gl.uniform2f(mouseLoc, mouseRef.x, h - mouseRef.y);
      
      // Bind previous frame texture (from read framebuffer)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read.texture);
      if (previousLoc) gl.uniform1i(previousLoc, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Render framebuffer to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      
      gl.clearColor(0.98, 0.96, 0.94, 1.0); // Bright white milk background color
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      // Render framebuffer to screen with color conversion
      gl.useProgram(copyProgram);
      const copyPosLoc = gl.getAttribLocation(copyProgram, 'a_position');
      const copyTexLoc = gl.getUniformLocation(copyProgram, 'u_texture');
      
      gl.enableVertexAttribArray(copyPosLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.vertexAttribPointer(copyPosLoc, 2, gl.FLOAT, false, 0, 0);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, write.texture);
      if (copyTexLoc) gl.uniform1i(copyTexLoc, 0);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      requestAnimationFrame(render);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mouseRef.prevX = mouseRef.x;
      mouseRef.prevY = mouseRef.y;
      mouseRef.x = (e.clientX - rect.left) * dpr;
      mouseRef.y = (e.clientY - rect.top) * dpr;
    };

    const handleMouseLeave = () => {
      // Reset mouse position to invalid values when mouse leaves viewport
      mouseRef.prevX = mouseRef.x;
      mouseRef.prevY = mouseRef.y;
      mouseRef.x = -1.0;
      mouseRef.y = -1.0;
    };

    const handleResize = () => {
      const newSize = resize();
      if (newSize.w !== w || newSize.h !== h) {
        w = newSize.w;
        h = newSize.h;
        // Recreate framebuffers on resize
        const newFbo1 = createFBO(w, h);
        const newFbo2 = createFBO(w, h);
        if (newFbo1 && newFbo2) {
          fbo1 = newFbo1;
          fbo2 = newFbo2;
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.framebuffer);
          gl.viewport(0, 0, w, h);
          gl.clearColor(0.0, 0.5, 0.5, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2.framebuffer);
          gl.viewport(0, 0, w, h);
          gl.clearColor(0.0, 0.5, 0.5, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    render();

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ 
        display: 'block', 
        width: '100vw',
        height: '100dvh',
        position: 'fixed',
        top: '0px',
        left: '0px',
        zIndex: 1,
        backgroundColor: '#faf5f0',
        pointerEvents: 'auto'
      }}
    />
  );
}
