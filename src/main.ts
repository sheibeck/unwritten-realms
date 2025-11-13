import { createApp } from 'vue'
import router from './router'
import './style.scss'
import App from './App.vue'
import { createPinia } from 'pinia';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json' assert { type: 'json' };
import AmplifyVue from '@aws-amplify/ui-vue';
import '@aws-amplify/ui-vue/styles.css';

Amplify.configure(outputs);
const pinia = createPinia();

createApp(App)
    .use(router)
    .use(AmplifyVue)
    .use(pinia)
    .mount('#app');
