// Import map for every bench: the single place that pins the three.js version.
// Load it as a classic (blocking) script in <head>, before any module script:
//   <script src="../lib/importmap.js"></script>
(() => {
  const base = 'https://cdn.jsdelivr.net/npm/three@0.186.1';
  const map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({
    imports: {
      three: `${base}/build/three.webgpu.min.js`,
      'three/webgpu': `${base}/build/three.webgpu.min.js`,
      'three/tsl': `${base}/build/three.tsl.min.js`,
      'three/addons/': `${base}/examples/jsm/`,
    },
  });
  document.currentScript.after(map);
})();
