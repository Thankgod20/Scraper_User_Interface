// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ,
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message', payload);
  const title = payload.notification.title;
  const options = {
    body: payload.notification.body,
  };
  self.registration.showNotification(title, options);
});
