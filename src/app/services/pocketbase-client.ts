import PocketBase from 'pocketbase';
import { environment } from '../environments/environment';

export const pocketBase = new PocketBase(environment.pbUrl);
