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
    var navIcon = document.getElementById('nav-icon');
    var settingsIcon = document.getElementById('settings-icon');
    var listIcon = document.querySelector('a[href="/admin/users"] img');
    var confirmIcon = document.getElementById('confirm-icon');
    if (navIcon) {
      navIcon.src = '/iconfiles/account' + (theme === 'dark' ? 'W' : '') + '.png';
    }
    var historyIcon = document.getElementById('history-icon');
    if (historyIcon) {
      historyIcon.src = '/iconfiles/history' + (theme === 'dark' ? 'W' : '') + '.png';
    }
    if (listIcon) {
      listIcon.src = '/iconfiles/list' + (theme === 'dark' ? 'W' : '') + '.png';
    }
    if (confirmIcon) {
      confirmIcon.src = '/iconfiles/adminconfirm' + (theme === 'dark' ? 'W' : '') + '.png';
    }
    if (settingsIcon) {
      settingsIcon.src = '/iconfiles/settings' + (theme === 'dark' ? 'W' : '') + '.png';
    }
  }

  function init(){
    var settingsBtn = document.getElementById('settingsBtn');
    var settingsDropdown = document.getElementById('settingsDropdown');

    var existing = getCookie('theme');
    if (existing) applyTheme(existing);
    else applyTheme('light');

    if (settingsBtn && settingsDropdown) {
      settingsBtn.addEventListener('click', function(e){
        e.stopPropagation();
        settingsDropdown.classList.toggle('show');
      });

      document.addEventListener('click', function(){
        settingsDropdown.classList.remove('show');
      });

      document.querySelectorAll('.theme-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          var t = btn.getAttribute('data-theme');
          setCookie('theme', t, 365);
          applyTheme(t);
        });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();