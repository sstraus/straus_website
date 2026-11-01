/** Analytics only receives canonical routes selected by site code. */
(function () {
  const official = ['straus.it', 'www.straus.it'].includes(window.location.hostname);
  let previous = null;
  window.siteAnalytics = {
    track(path, title) {
      if (!official || !/^\/(?:blog\/(?:[a-z0-9-]+\/)?|about\/|skills\/|contact\/)?$/.test(path)) return;
      if (path === previous) return;
      if (previous === null) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', 'G-5106GB1TB1', {
          send_page_view: false,
          page_location: 'https://straus.it' + path,
          page_title: title,
          page_referrer: '',
        });
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-5106GB1TB1';
        document.head.appendChild(script);
      }
      window.gtag('event', 'page_view', {
        page_title: title,
        page_location: 'https://straus.it' + path,
        page_referrer: previous === null ? '' : 'https://straus.it' + previous,
      });
      previous = path;
    },
  };
})();
