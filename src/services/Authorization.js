import {apiUrl, auth0ClientId, auth0Domain, auth0ClientSecret} from "../globals";
import userDataRepository from '../stores/UserDataStore';
import {
    Linking, AsyncStorage, Alert
} from 'react-native';
import * as mx from './MixPanel';


export function toQueryString(params) {
    return '?' + Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
}


const loginWithAuth0 = (startingPage) => async (username, password) => {
    let loginResult = await fetch(auth0Domain + '/oauth/token', {
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({
            grant_type: 'password',
            username,
            password,
            scope: "openid email profile offline_access",
            client_id: auth0ClientId,
            // client_secret: auth0ClientSecret
        }),
        method: 'POST'
    });
    if (loginResult.status !== 200){
        return false;
    }
    loginResult = await loginResult.json();
    mx.identifyUser(username);

    //finish logging in
    const apiInfoResult = await userDataRepository.pullUserInfoFromApiAndStore(loginResult.id_token, loginResult.access_token, startingPage==='registration', loginResult.refresh_token);

    return apiInfoResult;
}

//email, password, firstName, lastName, userSubType-['mother', 'father', 'male_guardian', 'female_guardian']
async function registerWithAuth0(email, password, firstName, lastName, parent_type){
    let result = await fetch(auth0Domain + '/dbconnections/signup', {
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({
            email,
            password,
            connection: 'Username-Password-Authentication',
            client_id: auth0ClientId,
            user_metadata: {
                firstName,
                lastName,
                parent_type
            }
        }),
        method: 'POST'
    });
    if (result.status < 200 || result.status > 299) {
        result = {
            status: result.status,
            serverResponse: await result.text(),
            error: true
        };
        console.log(result);
        return result;
    }
    result = await result.json();
    mx.signupEvent(firstName, lastName, email);

    //finish logging in
    return await loginWithAuth0('registration')(email, password);
}

async function logOutFromAuth0(history) {
    await AsyncStorage.multiRemove([
        "@kiddiekredit:idToken",
        "@kiddiekredit:accessToken",
        "@kiddiekredit:refreshToken",
        "@kiddiekredit:expiresIn"
    ]);
    AsyncStorage.removeItem("BROWSING_MODE");

    history.push("/nonauth/login");
    return true;
}

async function loginWithRefreshToken(refreshToken) {
    let loginResult = await fetch(auth0Domain + '/oauth/token', {
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: auth0ClientId,
            refresh_token: refreshToken
        }),
        method: 'POST'
    });
    if (loginResult.status !== 200) {
        console.warn(loginResult);
        return false;
    }
    loginResult = await loginResult.json(); //{access_token, expires_in, id_token, scope, token_type}
    console.log('LOGGED IN W REFRESH TOKEN', loginResult);
    return loginResult;
}

async function triggerPWResetWithAuth0(email){
    console.log("Resetting password for "+email);
    let pwResetResult = await fetch(auth0Domain + '/dbconnections/change_password', {
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({
            client_id: auth0ClientId,
            connection: 'Username-Password-Authentication',
            email
        }),
        method: 'POST'
    });
    if (pwResetResult.status < 200 || pwResetResult.status > 299) {
        console.log(pwResetResult.status, await pwResetResult.text());
        return false;
    }
    return await pwResetResult.text();
}

export {
    loginWithAuth0,
    registerWithAuth0,
    logOutFromAuth0,
    loginWithRefreshToken,
    triggerPWResetWithAuth0
}

/* RESPONSE SHAPE WHEN LOGGING IN:
 {
   "currentUser": Object {
     "__v": 0,
     "_id": "5bb6380b61791d2cb83a3fa0",
     "auth0ID": "auth0|5bb63805bdd7bf2d95bdb2a7",
     "avatar": "",
     "email": "marjvic@gmail.com",
     "firstName": "Victor",
     "lastName": "Moreno",
     "userSubType": "father",
     "userType": "parent",
   },
   "familyUnit": Object {
     "__v": 0,
     "_id": "5bb6380b61791d2cb83a3fa1",
     "adminsList": Array [
       Object {
         "__v": 0,
         "_id": "5bb6380b61791d2cb83a3fa0",
         "auth0ID": "auth0|5bb63805bdd7bf2d95bdb2a7",
         "avatar": "",
         "email": "marjvic@gmail.com",
         "firstName": "Victor",
         "lastName": "Moreno",
         "userSubType": "father",
         "userType": "parent",
       },
     ],
     "choreExceptions": Array [],
     "existingChores": Array [],
     "existingRewards": Array [],
     "kidsList": Array [],
   },
 }


 */