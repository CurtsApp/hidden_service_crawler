export enum ActiveDogs {
    REQUESTS = "REQUESTS",
    DATABASE = "DB",
}

export class WatchDog {
    private name: string;
    private timeToStarve: number; //ms
    private onStarve: () => void;
    private feedingTimeout: any;

    constructor(name: string, timeToStarve: number, onStarve: () => void) {
        this.timeToStarve = timeToStarve;
        this.onStarve = onStarve;
        this.name = name;
        WatchDogManager.register(name, this);
    }

    feed() {
        if (this.feedingTimeout) {
            clearTimeout(this.feedingTimeout);
        }
        this.feedingTimeout = setTimeout(() => {
            console.log(`Watchdog "${this.name}" starved`);
            WatchDogManager.remove(this.name);
            this.onStarve();
        }, this.timeToStarve);
    }
}

export class WatchDogManager {
    private static watchDogs: { [name: string]: WatchDog };

    static remove(name: string) {
        delete WatchDogManager.watchDogs[name];
    }

    static register(name: string, dog: WatchDog) {
        if(!WatchDogManager.watchDogs) {
            WatchDogManager.watchDogs = {};
        }

        if (WatchDogManager.watchDogs.hasOwnProperty(name)) {
            throw new Error(`Watchdog already registered: ${name}`);
        }
        WatchDogManager.watchDogs[name] = dog;
    }

    static feed(name: string) {
        if (!WatchDogManager.watchDogs.hasOwnProperty(name)) {
            throw new Error(`Watchdog not registered: ${name}`);
        }
        WatchDogManager.watchDogs[name].feed();
    }
}