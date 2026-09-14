import { createResourceHooks } from './resource';
import { Lead, Contact, Company, Deal, Activity, Task, Product, Conversation } from '../types';
import { Meeting } from '../types/meeting';

export const leadsApi = createResourceHooks<Lead>('leads', '/leads');
export const contactsApi = createResourceHooks<Contact>('contacts', '/contacts');
export const companiesApi = createResourceHooks<Company>('companies', '/companies');
export const dealsApi = createResourceHooks<Deal>('deals', '/deals');
export const activitiesApi = createResourceHooks<Activity>('activities', '/activities');
export const tasksApi = createResourceHooks<Task>('tasks', '/tasks');
export const productsApi = createResourceHooks<Product>('products', '/products');
export const conversationsApi = createResourceHooks<Conversation>('conversations', '/conversations');
export const meetingsApi = createResourceHooks<Meeting>('meetings', '/meetings');
