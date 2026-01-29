import { ClientEventModule } from "reciple";

export class MyModule extends ClientEventModule<'my-event'> {
    event = 'my-event';
    once = false;

    onEvent(...args) {
        // Write your code here
    }
}

export default new MyModule();
