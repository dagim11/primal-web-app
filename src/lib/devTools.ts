import { onMount, onCleanup } from "solid-js";
import { ComponentLog, PrimalWindow } from "../types/primal";
import { logWarning } from "./logger";
import { uuidv4 } from "../utils";

const hook = (type: 'onPrimalComponentMount' | 'onPrimalComponentCleanup', data: ComponentLog) => {
  const fn = (window as PrimalWindow)[type];
  fn && fn(data);
};

export const hookForDev = (fn: Function) => {
  if (localStorage.getItem('devMode') !== 'true') {
    return fn;
  }

  return (props: any) => {
    const domId = props.id || `${fn.name}_${uuidv4()}`;
    const scope: ComponentLog = { name: fn.name, props, domId };

    onMount(() => {
      hook('onPrimalComponentMount', scope);
    });

    onCleanup(() => {
      hook('onPrimalComponentCleanup', scope);
    })

    try {
      props.id = domId;
    } catch (ex) {
      logWarning('Error setting hook id:', ex);
    }

    return fn(props);
  };
}
