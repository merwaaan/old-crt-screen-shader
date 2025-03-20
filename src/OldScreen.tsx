import { folder, Leva, useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";

import cassetteModelPath from "./models/cassette.glb";
import gameboyModelPath from "./models/gameboy.glb";
import tamagotchiModelPath from "./models/tamagotchi.glb";
import { ScreenPass, useScreenPassParameters } from "./ScreenPass";

export function OldScreen(props: { showControls: boolean }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement>();

  useRendering(canvas);

  return (
    <>
      <canvas
        ref={(element) => {
          if (element) {
            setCanvas(element);
          }
        }}
      />

      <Leva hidden={!props.showControls} />
    </>
  );
}

function useRendering(canvas: HTMLCanvasElement | undefined) {
  // Parameters

  const sceneParameters = useControls({
    scene: folder({
      automaticTransition: { value: true },
      objectDuration: { value: 5, min: 1, max: 30 },
      noiseDuration: { value: 0.7, min: 0.1, max: 5 },
    }),
  });

  const screenParameters = useScreenPassParameters();

  // Initialize the scene

  type Rendering = {
    scene: THREE.Scene;
    objectGroup: THREE.Group;
    transition: { state: "object" | "noise"; remainingTime: number };
    composer: EffectComposer;
    screenPass: ScreenPass;
  };

  const renderingRef = useRef<Rendering>();

  if (!renderingRef.current && canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas });

    const rect = canvas.parentElement?.getBoundingClientRect() ?? {
      width: 100,
      height: 100,
    };

    renderer.setSize(rect.width, rect.height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("white");

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const camera = new THREE.PerspectiveCamera(
      75,
      rect.width / rect.height,
      0.1,
      1000
    );
    camera.position.set(0, 0, -1);
    camera.lookAt(new THREE.Vector3());

    // Lighting

    const light1 = new THREE.PointLight(new THREE.Color("#fff9f2"), 8, 0, 0);
    light1.position.set(1, 1, -1);
    scene.add(light1);

    const light2 = new THREE.PointLight(new THREE.Color("#f2ffff"), 8, 0, 0);
    light2.position.set(-1, -1, -1);
    scene.add(light2);

    // Load the objects

    loadAssets({
      gameboy: gameboyModelPath,
      cassette: cassetteModelPath,
      tamagotchi: tamagotchiModelPath,
    }).then((assets) => {
      const gameboy = centeredObject(assets.gameboy);
      gameboy.rotateY(Math.PI / 2);
      gameboy.scale.setScalar(3.5);
      gameboy.visible = true;
      objectGroup.add(gameboy);

      const cassette = centeredObject(assets.cassette);
      cassette.rotateY(Math.PI / 2);
      cassette.rotateZ(Math.PI / 2);
      cassette.scale.setScalar(10);
      cassette.visible = false;
      objectGroup.add(cassette);

      const tamagotchi = centeredObject(assets.tamagotchi);
      tamagotchi.rotateY(Math.PI);
      tamagotchi.scale.setScalar(0.025);
      tamagotchi.visible = false;
      objectGroup.add(tamagotchi);
    });

    // Setup the screen effect

    const screenPass = new ScreenPass(screenParameters, renderer);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(screenPass);
    composer.addPass(new OutputPass());

    renderingRef.current = {
      scene,
      objectGroup,
      transition: {
        state: "object",
        remainingTime: sceneParameters.objectDuration,
      },
      composer,
      screenPass,
    };
  }

  // React to parameter updates

  const oldScreenParametersRef = useRef(screenParameters);

  if (renderingRef.current) {
    // Update the screen effect

    if (screenParameters != oldScreenParametersRef.current) {
      renderingRef.current.screenPass.parameters = screenParameters;

      oldScreenParametersRef.current = screenParameters;
    }
  }

  const oldSceneParametersRef = useRef(sceneParameters);
  oldSceneParametersRef.current = sceneParameters;

  // Render loop

  useEffect(() => {
    let frame = 0;

    const clock = new THREE.Clock();

    function render() {
      if (renderingRef.current) {
        const delta = clock.getDelta();

        // Spin the object

        renderingRef.current.objectGroup.rotateY(delta * 0.25);

        // Transition

        if (oldSceneParametersRef.current.automaticTransition) {
          renderingRef.current.transition.remainingTime -= delta;
        }

        if (renderingRef.current.transition.remainingTime <= 0) {
          if (renderingRef.current.transition.state == "object") {
            renderingRef.current.screenPass.parameters.staticNoiseIntensity = 1;

            renderingRef.current.transition = {
              state: "noise",
              remainingTime: oldSceneParametersRef.current.noiseDuration,
            };
          } else {
            renderingRef.current.screenPass.parameters.staticNoiseIntensity = 0;

            const previousObjectIndex =
              renderingRef.current.objectGroup.children.findIndex(
                (object) => object.visible
              );

            renderingRef.current.objectGroup.children[
              previousObjectIndex
            ].visible = false;

            const nextObjectIndex =
              (previousObjectIndex + 1) %
              renderingRef.current.objectGroup.children.length;

            renderingRef.current.objectGroup.children[nextObjectIndex].visible =
              true;

            renderingRef.current.transition = {
              state: "object",
              remainingTime: oldSceneParametersRef.current.objectDuration,
            };
          }
        }

        // Render

        renderingRef.current.composer.render();
      }

      frame = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
}

function centeredObject(object: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(object);
  box.getCenter(object.position);
  object.position.negate();

  const group = new THREE.Group();
  group.add(object);
  return group;
}

async function loadAssets<
  TAssets extends Record<string, string>,
  TResult extends { [key in keyof TAssets]: THREE.Group },
>(assets: TAssets): Promise<TResult> {
  const result: Record<string, THREE.Group> = {};

  for (const asset in assets) {
    const gltf = await new GLTFLoader().loadAsync(
      new URL(assets[asset], import.meta.url).toString()
    );

    result[asset] = gltf.scene;
  }

  return result;
}
