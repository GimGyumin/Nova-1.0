# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateTodo, useListTodosForUser, useUpdateGoalTaskCompletion, useListPublicScheduleEvents } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateTodo(createTodoVars);

const { data, isPending, isSuccess, isError, error } = useListTodosForUser(listTodosForUserVars);

const { data, isPending, isSuccess, isError, error } = useUpdateGoalTaskCompletion(updateGoalTaskCompletionVars);

const { data, isPending, isSuccess, isError, error } = useListPublicScheduleEvents();

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createTodo, listTodosForUser, updateGoalTaskCompletion, listPublicScheduleEvents } from '@dataconnect/generated';


// Operation CreateTodo:  For variables, look at type CreateTodoVars in ../index.d.ts
const { data } = await CreateTodo(dataConnect, createTodoVars);

// Operation ListTodosForUser:  For variables, look at type ListTodosForUserVars in ../index.d.ts
const { data } = await ListTodosForUser(dataConnect, listTodosForUserVars);

// Operation UpdateGoalTaskCompletion:  For variables, look at type UpdateGoalTaskCompletionVars in ../index.d.ts
const { data } = await UpdateGoalTaskCompletion(dataConnect, updateGoalTaskCompletionVars);

// Operation ListPublicScheduleEvents: 
const { data } = await ListPublicScheduleEvents(dataConnect);


```