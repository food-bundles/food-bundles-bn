import africastalking from "africastalking";

const AT = africastalking({
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
});

export default AT;
