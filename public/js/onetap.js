/**
 * @fileoverview Script that helps RP Frame to serve GIS OneTap
 */

const ACTIONS = {
  RESIZE: 'resize',
  REDIRECT: 'redirect',
  UI_MODE: 'ui_mode',
  CLOSE: 'close',
  CLICK_CANCEL: 'click_cancel',
}

const CONTAINER_ID = 'rp-onetap-iframe-container';

let parentOrigin =
    document.referrer ? (new URL(document.referrer)).origin : null;

function allowOrigin_(whitelist) {
  const origin = parentOrigin;
  if (whitelist.indexOf(origin) != -1) {
    return origin;
  }
  console.log('origin not matched');
  return null;
}

function handleActivity_(whitelist, activity) {
  console.log(activity);
  if (parent === window) {
    return;
  }
  if (activity.type === 'ui_change') {
    if (activity.uiActivityType === 'prompt_resized') {
      parent.postMessage(
          {
            action: ACTIONS.RESIZE,
            detail: {newHeight: activity.detail.newHeight}
          },
          allowOrigin_(whitelist));
    } else if (activity.uiActivityType === 'ui_mode_changed') {
      parent.postMessage(
          {action: ACTIONS.UI_MODE, detail: {uiMode: activity.detail.uiMode}},
          allowOrigin_(whitelist));
    } else if (activity.uiActivityType === 'prompt_displayed') {
      parent.postMessage({action: ACTIONS.DISPLAY}, allowOrigin_(whitelist));
    } else if (activity.uiActivityType === 'prompt_closed') {
      parent.postMessage({action: ACTIONS.CLOSE}, allowOrigin_(whitelist));
    } else {
      // Do nothing.
    }
  }
}

function handlePostMessage_(data) {
  switch (data.action) {
    case ACTIONS.CLICK_CANCEL:
      google.accounts.id.cancel();
      break;
    default:
      console.log(data);
  }
}

function xhrPost_(url, data, callback) {
  let formData = new FormData();
  if (data) {
    Object.keys(data).map((name) => {
      formData.append(name, data[name]);
    });
  }
  const request = new XMLHttpRequest();
  if (callback) {
    request.onreadystatechange = () => {
      callback(request);
    };
  }
  request.open('POST', url, true);
  request.send(formData);
}

function initializeOneTapScript(options) {
  window.addEventListener('message', (event) => {
    handlePostMessage_(event.data);
  });
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  document.body.appendChild(container);
  const baseUrl = 'http://kefany.svl.corp.google.com:9879';
  const gisOptions = {
    client_id: options.client_id,
    prompt_url: `${baseUrl}/gsi/iframe/select`,
    status_url: `${baseUrl}/gsi/status`,
    auto_select: options.auto_select,
    activity_listener: handleActivity_.bind(this, options.parent_origin),
    prompt_parent_id: CONTAINER_ID,
    callback: (credentialResponse) => {
      let postBody = {};
      postBody['credential'] = credentialResponse['credential'];
      xhrPost_(options.login_url, postBody, (xhr) => {
        if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
          if (parent && parent.postMessage) {
            parent.postMessage(
                {
                  action: 'redirect',
                  detail: {
                    url: options.redirect_url,
                  }
                },
                allowOrigin_(options.parent_origin));
          }
        }
      });
    },
  };
  google.accounts.id.initialize(gisOptions);
  google.accounts.id.prompt();
}
