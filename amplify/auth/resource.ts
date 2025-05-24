import { defineAuth, secret } from '@aws-amplify/backend'

export const auth = defineAuth({
    loginWith: {
      email: {
        verificationEmailStyle: "CODE",
        verificationEmailSubject: "Welcome to Unwritten Worlds!",
        verificationEmailBody: (createCode) => `Use this code to confirm your account: ${createCode()}`,
      },
      externalProviders: {
        google: {
          clientId: secret('GOOGLE_CLIENT_ID'),
          clientSecret: secret('GOOGLE_CLIENT_SECRET'),
          attributeMapping: {
            email: 'email'
          },
          scopes: ['email']
        },
        // signInWithApple: {
        //   clientId: secret('SIWA_CLIENT_ID'),
        //   keyId: secret('SIWA_KEY_ID'),
        //   privateKey: secret('SIWA_PRIVATE_KEY'),
        //   teamId: secret('SIWA_TEAM_ID')
        // },
        // loginWithAmazon: {
        //   clientId: secret('LOGINWITHAMAZON_CLIENT_ID'),
        //   clientSecret: secret('LOGINWITHAMAZON_CLIENT_SECRET')
        // },
        // facebook: {
        //   clientId: secret('FACEBOOK_CLIENT_ID'),
        //   clientSecret: secret('FACEBOOK_CLIENT_SECRET')
        // },
        callbackUrls: [
          'https://localhost:5173',
          'https://main.d2uz5eq9utaspz.amplifyapp.com',
        ],
        logoutUrls: ['https://localhost:5173/', 'https://main.d2uz5eq9utaspz.amplifyapp.com/'],
      }
    }
  });
