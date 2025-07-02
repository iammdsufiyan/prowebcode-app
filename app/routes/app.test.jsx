import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from '@remix-run/react';

// In a real app, this would be stored in a database
let userData = {
  name: "test",
  email: "abc@gmail.com"
};

export async function loader() {
  return json(userData);
}

export async function action({ request }) {
  const formData = await request.formData()
  
  // Update the stored data
  userData = {
    name: formData.get("displayName") || userData.name,
    email: formData.get("email") || userData.email,
  };
  
  // Return success message and redirect back to the same page
  return redirect("/app/test");
}

const test = () => {
  const user = useLoaderData();
  console.log(user);
  
  return (
    <Form method="post">
      <h1>Settings for {user.name}</h1>

      <input
        name="displayName"
        defaultValue={user.name}
      />
      <input
        name="email"
        defaultValue={user.email}
      />

      <button type="submit">Save</button>
    </Form>
  );
};

export default test