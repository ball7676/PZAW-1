(function(){
  function getCookie(name){
    const v = document.cookie.match('(?:^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? decodeURIComponent(v[1]) : null;
  }
  function setCookie(name, value, days){
    var expires = "";
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + (days*24*60*60*1000));
      expires = "; expires=" + d.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
  }
  function applyTheme(theme){
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-theme') === theme);
    });
  }


  function init(){
    if (!document.getElementById('cookie-popup')) {
      document.body.appendChild(injected);
    }

    var popup = document.getElementById('cookie-popup');
    var openBtn = document.getElementById('theme-open');
    var saveBtn = document.getElementById('cookie-save');
    var closeBtn = document.getElementById('cookie-close');
    var themeButtons = document.querySelectorAll('.theme-btn');

    var existing = getCookie('site_theme');
    if (existing) applyTheme(existing);
    else setTimeout(showPopup, 700);

    function showPopup(){
      if (!popup) return;
      popup.classList.remove('hidden');
      popup.setAttribute('aria-hidden', 'false');
    }
    function hidePopup(){
      if (!popup) return;
      popup.classList.add('hidden');
      popup.setAttribute('aria-hidden', 'true');
    }

    themeButtons.forEach(function(btn){
      btn.addEventListener('click', function(){
        var t = btn.getAttribute('data-theme');
        applyTheme(t);
      });
    });

    if (saveBtn) saveBtn.addEventListener('click', function(){
      var active = document.querySelector('.theme-btn.active');
      var theme = active ? active.getAttribute('data-theme') : (getCookie('site_theme') || 'light');
      setCookie('site_theme', theme, 365);
      applyTheme(theme);
      hidePopup();
    });

    if (closeBtn) closeBtn.addEventListener('click', function(){
      hidePopup();
    });

    if (openBtn) openBtn.addEventListener('click', function(){
      showPopup();
    });

    window.setSiteTheme = function(theme, persist){
      applyTheme(theme);
      if (persist) setCookie('site_theme', theme, 365);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();