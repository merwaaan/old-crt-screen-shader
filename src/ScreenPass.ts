import { folder, useControls } from "leva";
import _ from "lodash";
import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass";

import { colorConversion } from "./shaders";

export function useScreenPassParameters() {
  return useControls({
    screen: folder({
      resolutionRatio: { value: 0.5, min: 0.01, max: 1 },
      scanlines: folder({
        scanlinesIntensity: {
          label: "intensity",
          value: 0.5,
          min: 0,
          max: 1,
        },
      }),
      staticNoise: folder({
        staticNoiseIntensity: {
          label: "intensity",
          value: 0.05,
          min: 0,
          max: 1,
        },
        staticNoiseFrequency: {
          label: "frequency",
          value: 30,
          min: 0,
          max: 30,
        },
      }),
      brightnessNoise: folder({
        brightnessNoiseIntensity: {
          label: "intensity",
          value: 0.05,
          min: 0,
          max: 1,
        },
        brightnessNoiseFrequency: {
          label: "frequency",
          value: 20,
          min: 1,
          max: 30,
        },
      }),
      horizontalTearing: folder({
        horizontalTearingIntensity: {
          label: "intensity",
          value: 0.1,
          min: 0,
          max: 1,
        },
        horizontalTearingFrequency: {
          label: "frequency",
          value: 20,
          min: 1,
          max: 30,
        },
      }),
      rollingBand: folder({
        rollingBandEnabled: { label: "enabled", value: true },
        rollingBandDuration: { label: "duration", value: 3, min: 0.5, max: 10 },
        // rollingBandFrequency: {
        //   label: "frequencyTODO",
        //   value: 5,
        //   min: 0.5,
        //   max: 10,
        // },
        rollingBandHeight: {
          label: "height",
          value: 0.05,
          min: 0.01,
          max: 0.5,
        },
        rollingBandStaticNoise: {
          label: "static noise",
          value: 0.1,
          min: 0,
          max: 1,
        },
        rollingBandBrightnessNoise: {
          label: "brightness noise",
          value: 0.1,
          min: 0,
          max: 1,
        },
        rollingBandHorizontalTearing: {
          label: "horizontal tearing",
          value: 0.7,
          min: 0,
          max: 1,
        },
        rollingBandChromaticAberration: {
          label: "chromatic aberration",
          value: 0.3,
          min: 0,
          max: 1,
        },
      }),
      // blur: folder({
      //   // TODO intensity?
      //   blurSpread: {
      //     label: "spread",
      //     value: 100,
      //     min: 50,
      //     max: 1000,
      //   },
      // }),
      // bloom: folder({
      //   bloomThreshold: {
      //     label: "threshold",
      //     value: 0,
      //     min: 0,
      //     max: 1,
      //   },
      //   bloomSpread: {
      //     label: "spread",
      //     value: 100,
      //     min: 50,
      //     max: 1000,
      //   },
      // }),
      vignette: folder({
        vignetteIntensity: {
          label: "intensity",
          value: 0.22,
          min: 0,
          max: 1,
        },
        vignetteFalloff: {
          label: "falloff",
          value: 20,
          min: 1,
          max: 100,
        },
      }),
      image: folder({
        // saturation: { value: 0.5, min: 0, max: 1 },
        // contrast: { value: 0.5, min: 0, max: 1 },
        chromaticAberrationIntensity: { value: 0.1, min: 0, max: 1 },

        curvatureIntensity: {
          label: "curvature intensity",
          value: 2.5,
          min: 0.5,
          max: 15,
        },
      }),
    }),
  });
}

type Parameters = ReturnType<typeof useScreenPassParameters>;

export type ScreenPassParameters = {
  [K in keyof Parameters]: Parameters[K];
};

type BaseUniforms = {
  image: { value: THREE.Texture | null };
  time: { value: number };
  viewport: { value: THREE.Vector2 };
};

type Uniforms = BaseUniforms & {
  [K in keyof ScreenPassParameters]: { value: ScreenPassParameters[K] };
};

type ParametersUniforms = Omit<Uniforms, keyof BaseUniforms>;

function parametersToUniforms(
  parameters: ScreenPassParameters
): ParametersUniforms {
  return {
    ...Object.fromEntries(
      Object.entries(parameters).map(([name, value]) => [name, { value }])
    ),
  } as ParametersUniforms;
}

export class ScreenPass extends Pass {
  parameters: ScreenPassParameters;

  private uniforms: Uniforms;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  private renderer: THREE.WebGLRenderer; // TODO update size in render

  constructor(parameters: ScreenPassParameters, renderer: THREE.WebGLRenderer) {
    super();

    this.parameters = parameters;

    const size = new THREE.Vector2();
    renderer.getSize(size);

    this.uniforms = {
      image: { value: null },
      time: { value: 0 },
      viewport: { value: size },
      ...parametersToUniforms(this.parameters),
    };

    this.renderer = renderer;

    this.material = new THREE.ShaderMaterial({
      name: "Screen",
      uniforms: this.uniforms,
      vertexShader: `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: `
#include <common>

${colorConversion}

varying vec2 vUv;

uniform sampler2D image;
uniform float time;
uniform vec2 viewport;

uniform float resolutionRatio;

uniform float scanlinesIntensity;

uniform float staticNoiseIntensity;
uniform float staticNoiseFrequency;

uniform float brightnessNoiseIntensity;
uniform float brightnessNoiseFrequency;

uniform float horizontalTearingIntensity;
uniform float horizontalTearingFrequency;

uniform float chromaticAberrationIntensity;

uniform float curvatureIntensity;

uniform float vignetteIntensity;
uniform float vignetteFalloff;

uniform bool rollingBandEnabled;
uniform float rollingBandDuration;
uniform float rollingBandHeight;
uniform float rollingBandStaticNoise;
uniform float rollingBandBrightnessNoise;
uniform float rollingBandHorizontalTearing;
uniform float rollingBandChromaticAberration;

uniform float saturation;

void main() {

  vec3 outColor;
  vec2 outUv;

  // Curvature

  vec2 centeredUv  = vUv * 2.0 - 1.0;
  vec2 offset = abs(centeredUv.yx) / curvatureIntensity;
  vec2 curvedUv = (centeredUv + centeredUv * offset * offset) * 0.5 + 0.5;

  if (curvedUv.x < 0.0 || curvedUv.y < 0.0 || curvedUv.x > 1.0 || curvedUv.y > 1.0){
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  outUv = curvedUv;

  // Resolution

  vec2 grilleResolution = viewport * resolutionRatio;
  vec2 grilleUv = (floor(curvedUv * grilleResolution) + 0.5) / grilleResolution;

  outUv = grilleUv;

  // Rolling band

  float rollingBand = 0.0;

  if (rollingBandEnabled) {
    float rollingBandTime = 1.0 - fract(time / rollingBandDuration);

    float rollingBandDistance = (outUv.y - rollingBandTime) / rollingBandHeight;

    if (abs(rollingBandDistance) < 1.0) {
      rollingBand = cos(rollingBandDistance * PI) + 1.0;
      rollingBand += rollingBand * cos(rollingBandDistance * 7.0 + time * 5.0 ) * 0.2;
    }
  }

  // Horizontal tearing

  const float MAX_HORIZONTAL_TEARING_INTENSITY = 0.01;

  float horizontalTearingTime = floor(time * horizontalTearingFrequency);
  vec2 horizontalTearingSeed = vec2(grilleUv.y, horizontalTearingTime);

  outUv.x += (rand(horizontalTearingSeed) * 2.0 - 1.0) * horizontalTearingIntensity * MAX_HORIZONTAL_TEARING_INTENSITY;
  outUv.x -= rollingBand * rollingBandHorizontalTearing * MAX_HORIZONTAL_TEARING_INTENSITY;
  outUv.x = clamp(outUv.x, 0.01, 0.99);

  // Chromatic aberration

  outColor = texture2D(image, outUv).rgb;

  const float MAX_CHROMATIC_ABBERATION_INTENSITY = 0.01;

  float chromaticAberrationAmplitude = chromaticAberrationIntensity + rollingBand * rollingBandChromaticAberration;

  outColor.r = texture2D(image, outUv + vec2(+chromaticAberrationAmplitude * MAX_CHROMATIC_ABBERATION_INTENSITY, 0.0)).r;
  outColor.b = texture2D(image, outUv + vec2(-chromaticAberrationAmplitude * MAX_CHROMATIC_ABBERATION_INTENSITY, 0.0)).b;

  // Brightness noise

  const float MAX_BRIGHTNESS_NOISE_INTENSITY = 1.0;

  float brightnessNoiseTime = floor(time * brightnessNoiseFrequency);
  vec2 brightnessNoiseSeed = grilleUv * brightnessNoiseTime;
  float brightnessNoise = rand(brightnessNoiseSeed);

  outColor += vec3(brightnessNoise) * brightnessNoiseIntensity * MAX_BRIGHTNESS_NOISE_INTENSITY;
  outColor += vec3(brightnessNoise) * rollingBand * rollingBandBrightnessNoise;

  // Static noise

  float staticNoiseTime = floor(time * staticNoiseFrequency);
  vec2 staticNoiseSeed = grilleUv * staticNoiseTime;
  float staticNoise = rand(staticNoiseSeed);

  outColor = mix(outColor, vec3(staticNoise), min(1.0, staticNoiseIntensity + abs(rollingBand) * rollingBandStaticNoise));

  // Scanlines

  float scanlinesMask = sin(fract(vUv.y * grilleResolution.y) * PI);

  outColor *= mix(1.0, scanlinesMask, scanlinesIntensity);

  // Vignette
  // https://www.shadertoy.com/view/lsKSWR

  vec2 vignetteUv = outUv * (1.0 - outUv.yx);
  float vignette = pow(vignetteUv.x * vignetteUv.y * vignetteFalloff, vignetteIntensity);

  outColor *= vignette;

  gl_FragColor = vec4(outColor, 1.0);








  // // Saturation

  // //vec3 hsl = rgb_to_hsl(base.rgb);
  // //hsl.y = saturation;
  // //vec3 rgb = hsl_to_rgb(hsl);
  // //gl_FragColor = vec4(rgb, 1);
  // //return;

}`,
    });

    this.quad = new FullScreenQuad(this.material);
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number
  ) {
    this.uniforms.image.value = readBuffer.texture;
    this.uniforms.time.value += deltaTime;
    // TODO viewport

    _.assign(this.uniforms, parametersToUniforms(this.parameters));

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.quad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.quad.render(renderer);
    }
  }

  override dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}
