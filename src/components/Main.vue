<template>
  <v-container>
    <v-row class="text-center">
      <v-col cols="6"> David M. Noll </v-col>
      <v-col cols="6">
        <a :href="this.paths.resume"> Resume </a>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "Main",

  data() {
    return {
      paths: {
        resume: "pdf/DavidNoll-Resume.pdf",
      },
      links: [
        // {
        //   text: "Articles",
        //   href: "https://medium.com/vuetify",
        // },
      ],
    };
  },
});
</script>
