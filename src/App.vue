<template>
  <div id="app" class="d-flex flex-column min-vh-100">
    <!-- Navbar -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark px-4">
      <!-- Brand -->
      <router-link to="/" class="navbar-brand d-flex align-items-center gap-2">
        <!--<img src="./assets/logo.png" alt="Logo" class="logo-img" />-->
        <div class="d-flex flex-column lh-1 logo-text">
          <span class="fw-bold fs-5">Unwritten Realms</span>
        </div>
      </router-link>

      <!-- Toggler -->
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Nav Content -->
      <div class="collapse navbar-collapse" id="navbarNav">
        <!-- Left Nav -->
        <ul class="navbar-nav">
         
        </ul>

        <!-- Right Nav (Sign-In or Sign-Out Button) -->
        <ul class="navbar-nav ms-auto">
          <li class="nav-item" v-if="user">
            <button @click="doSignOut()" class="btn btn-outline-light">Logout</button>
          </li>
          <li class="nav-item" v-else>
            <router-link to="/signin" class="nav-link">Sign-In</router-link>
          </li>
        </ul>
      </div>
    </nav>

    <main class="flex-fill d-flex flex-column w-100 p-0">
      <router-view class="flex-fill d-flex flex-column" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { getCurrentUser, signOut } from '@aws-amplify/auth';
import { onMounted, ref } from 'vue';

const user = ref();

async function getUserAuth() {
  try {
    const { userId } = await getCurrentUser();
    user.value = userId;
  }
  catch {
    user.value = null;
  }
}

async function doSignOut() {
  await signOut();
}

onMounted(() => {
  getUserAuth()
})
</script>

<style scoped>
#app {
  margin: 0;
  padding: 0;
}

main {
  background-color: #1e1e1e;
  overflow-y: auto;
}
</style>
