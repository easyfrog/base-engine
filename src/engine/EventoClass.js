/**
 * Evento class
 */
export class Evento {
    constructor() {
        this._handlers = {};
        this._state = {};
    }

    /**
    * @param {string} eventName 
    * @param {boolean} boo 
    */
    setEventState(eventName, boo) {
        this._state[eventName] = boo;
    }

    /**
     * @param {string} eventName 
     * @returns {boolean}
     */
    getEventState(eventName) {
        return this._state[eventName] === false ? false : true;
    }

    /**
     * @param {string|string[]} eventName 
     * @param {Function} handler 
     * @returns {Function}
     */
    on(eventName, handler) {
        // either use the existing array or create a new one for this event
        //      this isn't the most efficient way to do this, but is the shorter
        //      than other more efficient ways, so we'll go with it for now.

        // ztc 20210407 add eventName array support
        var ens = [].concat(eventName);

        ens.forEach(en => {
            (this._handlers[en] = this._handlers[en] || [])
                // add the handler to the array
                .push(handler);
        })

        // return obj;

        function off() {
            ens.forEach(en => {
                obj.off(en, handler);
            })
            // obj.off(eventName, handler);
        }

        return off;
    };

    /**
     * @param {string} eventName 
     * @returns {Function[]}
     */
    getHandlers(eventName) {
        return eventName ? this._handlers[eventName] : handlers;
    }

    /**
     * clear specified event's handler or ALL handlers
     * @param {string} eventName 
     */
    clearHandlers(eventName) {
        if (eventName) {
            this._handlers[eventName] = {};
            delete this._state[eventName];
        } else {
            this._handlers = {};
            this._state = {};
        }
    }

    /**
     * @param {string|string[]} eventName 
     * @param {Function} handler 
     * @returns {Function}
     */
    once(eventName, handler) {
        var obj = this
        function wrappedHandler() {
            handler.apply(obj.off(eventName, wrappedHandler), arguments);
        }

        wrappedHandler.h = handler;
        return this.on(eventName, wrappedHandler);
    }

    /**
     * remove a listener
     * @param {string} eventName
     * @param {Function} handler
     */
    off(eventName, handler) {
        for (var list = this._handlers[eventName], i = 0; handler && list && list[i]; i++) {
            list[i] != handler && list[i].h != handler ||
                // remove it!
                list.splice(i--, 1);
        }
        if (!handler) {
            delete this._handlers[eventName];
            delete this._state[eventName];
        }
        return this
    }

    /**
     * @param {string} eventName 
     * @returns 
     */
    emit(eventName) {

        //
        // 先判断这个eventName的state，如果为false则不触发此数据
        //
        if (this._state[eventName] === false) { return this }

        // add to object's '__events' to hold the event's name
        // 2021.6.10 Beijing home
        if (!this.__events) {
            this.__events = {};
        }

        this.__events[eventName] = eventName;

        for (var list = this._handlers[eventName], i = 0; list && list[i];) {
            list[i++].apply(this, list.slice.call(arguments, 1));
        }
        return this
    }
}

export function getSignal() {
    return new Evento()
}

export { Evento as default }