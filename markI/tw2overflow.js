/*!
 * tw2overflow v2.0.0
 * Sun, 06 Sep 2020 09:42:40 GMT
 * Developed by Relaxeaza <twoverflow@outlook.com>
 *
 * This work is free. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License, Version 2,
 * as published by Sam Hocevar. See the LICENCE file for more details.
 */

;(function (window, undefined) {

const $rootScope = injector.get('$rootScope')
const transferredSharedDataService = injector.get('transferredSharedDataService')
const modelDataService = injector.get('modelDataService')
const socketService = injector.get('socketService')
const routeProvider = injector.get('routeProvider')
const eventTypeProvider = injector.get('eventTypeProvider')
const windowDisplayService = injector.get('windowDisplayService')
const windowManagerService = injector.get('windowManagerService')
const angularHotkeys = injector.get('hotkeys')
const armyService = injector.get('armyService')
const villageService = injector.get('villageService')
const mapService = injector.get('mapService')
const $filter = injector.get('$filter')
const $timeout = injector.get('$timeout')
const storageService = injector.get('storageService')
const reportService = injector.get('reportService')
const noop = function () {}
const hasOwn = Object.prototype.hasOwnProperty

define('two/EventScope', [
    'queues/EventQueue'
], function (eventQueue) {
    const EventScope = function (windowId, onDestroy) {
        if (typeof windowId === 'undefined') {
            throw new Error('EventScope: no windowId')
        }

        this.windowId = windowId
        this.onDestroy = onDestroy || noop
        this.listeners = []

        const unregister = $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, (event, templateName) => {
            if (templateName === '!' + this.windowId) {
                this.destroy()
                unregister()
            }
        })
    }

    EventScope.prototype.register = function (id, handler, _root) {
        if (_root) {
            this.listeners.push($rootScope.$on(id, handler))
        } else {
            eventQueue.register(id, handler)

            this.listeners.push(function () {
                eventQueue.unregister(id, handler)
            })
        }
    }

    EventScope.prototype.destroy = function () {
        this.listeners.forEach((unregister) => {
            unregister()
        })

        this.onDestroy()
    }

    return EventScope
})

define('two/utils', [
    'helper/time',
    'helper/math'
], function (
    $timeHelper,
    $math
) {
    let utils = {}

    /**
     * Gera um número aleatório aproximado da base.
     *
     * @param {Number} base - Número base para o calculo.
     */
    utils.randomSeconds = function (base) {
        if (!base) {
            return 0
        }

        base = parseInt(base, 10)

        const max = base + (base / 2)
        const min = base - (base / 2)

        return Math.round(Math.random() * (max - min) + min)
    }

    /**
     * Converte uma string com um tempo em segundos.
     *
     * @param {String} time - Tempo que será convertido (hh:mm:ss)
     */
    utils.time2seconds = function (time) {
        time = time.split(':')
        time[0] = parseInt(time[0], 10) * 60 * 60
        time[1] = parseInt(time[1], 10) * 60
        time[2] = parseInt(time[2], 10)

        return time.reduce(function (a, b) {
            return a + b
        })
    }

    /**
     * Emite notificação nativa do jogo.
     *
     * @param {String} type - success || error
     * @param {String} message - Texto a ser exibido
     */
    utils.notif = function (type, message) {
        $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_DISABLE)
        $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_ENABLE)

        const eventType = type === 'success'
            ? eventTypeProvider.MESSAGE_SUCCESS
            : eventTypeProvider.MESSAGE_ERROR

        $rootScope.$broadcast(eventType, {
            message: message
        })
    }


    /**
     * Gera uma string com nome e coordenadas da aldeia
     *
     * @param {Object} village - Dados da aldeia
     * @return {String}
     */
    utils.genVillageLabel = function (village) {
        return village.name + ' (' + village.x + '|' + village.y + ')'
    }

    /**
     * Verifica se uma coordenada é válida.
     * 00|00
     * 000|00
     * 000|000
     * 00|000
     *
     * @param {String} xy - Coordenadas
     * @return {Boolean}
     */
    utils.isValidCoords = function (xy) {
        return /\s*\d{2,3}\|\d{2,3}\s*/.test(xy)
    }

    /**
     * Validação de horario e data de envio. Exmplo: 23:59:00:999 30/12/2016
     *
     * @param  {String}  dateTime
     * @return {Boolean}
     */
    utils.isValidDateTime = function (dateTime) {
        return /^\s*([01][0-9]|2[0-3]):[0-5]\d:[0-5]\d(:\d{1,3})? (0[1-9]|[12][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}\s*$/.test(dateTime)
    }

    /**
     * Inverte a posição do dia com o mês.
     */
    utils.fixDate = function (dateTime) {
        const dateAndTime = dateTime.trim().split(' ')
        const time = dateAndTime[0]
        const date = dateAndTime[1].split('/')

        return time + ' ' + date[1] + '/' + date[0] + '/' + date[2]
    }

    /**
     * Gera um id unico
     *
     * @return {String}
     */
    utils.guid = function () {
        return Math.floor((Math.random()) * 0x1000000).toString(16)
    }

    /**
     * Obtem o timestamp de uma data em string.
     * Formato da data: mês/dia/ano
     * Exmplo de entrada: 23:59:59:999 12/30/2017
     *
     * @param  {String} dateString - Data em formato de string.
     * @return {Number} Timestamp (milisegundos)
     */
    utils.getTimeFromString = function (dateString, offset) {
        const dateSplit = utils.fixDate(dateString).split(' ')
        const time = dateSplit[0].split(':')
        const date = dateSplit[1].split('/')

        const hour = time[0]
        const min = time[1]
        const sec = time[2]
        const ms = time[3] || null

        const month = parseInt(date[0], 10) - 1
        const day = date[1]
        const year = date[2]

        const _date = new Date(year, month, day, hour, min, sec, ms)

        return _date.getTime() + (offset || 0)
    }

    /**
     * Formata milisegundos em hora/data
     *
     * @return {String} Data e hora formatada
     */
    utils.formatDate = function (ms, format) {
        return $filter('readableDateFilter')(
            ms,
            null,
            $rootScope.GAME_TIMEZONE,
            $rootScope.GAME_TIME_OFFSET,
            format || 'HH:mm:ss dd/MM/yyyy'
        )
    }

    /**
     * Obtem a diferença entre o timezone local e do servidor.
     *
     * @type {Number}
     */
    utils.getTimeOffset = function () {
        const localDate = $timeHelper.gameDate()
        const localOffset = localDate.getTimezoneOffset() * 1000 * 60
        const serverOffset = $rootScope.GAME_TIME_OFFSET

        return localOffset + serverOffset
    }

    utils.xhrGet = function (url, dataType = 'text') {
        return new Promise(function (resolve, reject) {
            if (!url) {
                return reject()
            }

            let xhr = new XMLHttpRequest()
            xhr.open('GET', url, true)
            xhr.responseType = dataType
            xhr.addEventListener('load', function () {
                resolve(xhr)
            }, false)

            xhr.send()
        })
    }

    utils.obj2selectOptions = function (obj, _includeIcon) {
        let list = []

        for (let i in obj) {
            let item = {
                name: obj[i].name,
                value: obj[i].id
            }

            if (_includeIcon) {
                item.leftIcon = obj[i].icon
            }

            list.push(item)
        }

        return list
    }

    /**
     * @param {Object} origin - Objeto da aldeia origem.
     * @param {Object} target - Objeto da aldeia alvo.
     * @param {Object} units - Exercito usado no ataque como referência
     * para calcular o tempo.
     * @param {String} type - Tipo de comando (attack,support,relocate)
     * @param {Object} officers - Oficiais usados no comando (usados para efeitos)
     *
     * @return {Number} Tempo de viagem
     */
    utils.getTravelTime = function (origin, target, units, type, officers, useEffects) {
        const targetIsBarbarian = !target.character_id
        const targetIsSameTribe = target.character_id && target.tribe_id &&
                target.tribe_id === modelDataService.getSelectedCharacter().getTribeId()

        if (useEffects !== false) {
            if (type === 'attack') {
                if ('supporter' in officers) {
                    delete officers.supporter
                }

                if (targetIsBarbarian) {
                    useEffects = true
                }
            } else if (type === 'support') {
                if (targetIsSameTribe) {
                    useEffects = true
                }

                if ('supporter' in officers) {
                    useEffects = true
                }
            }
        }

        const army = {
            units: units,
            officers: angular.copy(officers)
        }

        const travelTime = armyService.calculateTravelTime(army, {
            barbarian: targetIsBarbarian,
            ownTribe: targetIsSameTribe,
            officers: officers,
            effects: useEffects
        }, type)

        const distance = $math.actualDistance(origin, target)

        const totalTravelTime = armyService.getTravelTimeForDistance(
            army,
            travelTime,
            distance,
            type
        )

        return totalTravelTime * 1000
    }

    utils.each = function (obj, iterator) {
        if (typeof iterator !== 'function') {
            iterator = noop
        }

        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (iterator(obj[i], i) === false) {
                    return false
                }
            }
        } else if (angular.isObject(obj)) {
            for (let i in obj) {
                if (hasOwn.call(obj, i)) {
                    if (iterator(obj[i], i) === false) {
                        return false
                    }
                }
            }
        }

        return true
    }

    return utils
})

define('two/ready', [
    'conf/gameStates',
    'two/mapData'
], function (
    GAME_STATES,
    twoMapData
) {
    let queueRequests = {}

    const ready = function (callback, which) {
        which = which || ['map']

        if (typeof which === 'string') {
            which = [which]
        }

        const readyStep = function (item) {
            which = which.filter(function (_item) {
                return _item !== item
            })

            if (!which.length) {
                callback()
            }
        }

        const handlers = {
            'map': function () {
                const mapScope = transferredSharedDataService.getSharedData('MapController')

                if (mapScope.isInitialized) {
                    return readyStep('map')
                }

                $rootScope.$on(eventTypeProvider.MAP_INITIALIZED, function () {
                    readyStep('map')
                })
            },
            'tribe_relations': function () {
                const $player = modelDataService.getSelectedCharacter()

                if ($player) {
                    const $tribeRelations = $player.getTribeRelations()

                    if (!$player.getTribeId() || $tribeRelations) {
                        return readyStep('tribe_relations')
                    }
                }

                const unbind = $rootScope.$on(eventTypeProvider.TRIBE_RELATION_LIST, function () {
                    unbind()
                    readyStep('tribe_relations')
                })
            },
            'initial_village': function () {
                const $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.INITIAL_VILLAGE_READY)) {
                    return readyStep('initial_village')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_INITIAL_VILLAGE_READY, function () {
                    readyStep('initial_village')
                })
            },
            'all_villages_ready': function () {
                const $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
                    return readyStep('all_villages_ready')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                    readyStep('all_villages_ready')
                })
            },
            'minimap_data': function () {
                if (twoMapData.isLoaded()) {
                    return readyStep('minimap_data')
                }

                twoMapData.load(function () {
                    readyStep('minimap_data')
                })
            },
            'presets': function () {
                if (modelDataService.getPresetList().isLoaded()) {
                    return readyStep('presets')
                }

                queueRequests.presets = queueRequests.presets || new Promise(function (resolve) {
                    socketService.emit(routeProvider.GET_PRESETS, {}, resolve)
                })

                queueRequests.presets.then(function () {
                    readyStep('presets')
                })
            },
            'world_config': function () {
                if (modelDataService.getWorldConfig && modelDataService.getWorldConfig()) {
                    return readyStep('world_config')
                }

                setTimeout(handlers['world_config'], 100)
            }
        }

        const mapScope = transferredSharedDataService.getSharedData('MapController')

        if (!mapScope) {
            return setTimeout(function () {
                ready(callback, which)
            }, 100)
        }

        which.forEach(function (readyItem) {
            handlers[readyItem]()
        })
    }

    return ready
})

require([
    'two/ready',
    'Lockr'
], function (
    ready,
    Lockr
) {
    ready(function () {
        let $player = modelDataService.getSelectedCharacter()

        // Lockr settings
        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-'
    })
})

define('two/language', [
    'helper/i18n'
], function (
    i18n
) {
    let initialized = false
    const languages = {
    "en_us": {
        "about": {
            "contact": "Kontakt",
            "email": "Email",
            "links": "Linki projektów",
            "source_code": "Kod źródłowy",
            "issues_suggestions": "Błędy/sugestie",
            "translations": "Tłumaczenia"
        },
        "attack_view": {
            "title": "Strażnik",
            "filter_types": "Rodzaj",
            "filter_show_attacks_tooltip": "Pokaż ataki",
            "filter_show_supports_tooltip": "Pokaż wsparcia",
            "filter_show_relocations_tooltip": "Pokaż przeniesienia",
            "filter_incoming_units": "Nadchodzące jednostki",
            "commands_copy_arrival_tooltip": "Kopiuj czas dotarcia.",
            "commands_copy_backtime_tooltip": "Kopiuj czas powrotu.",
            "commands_set_remove_tooltip": "Wstaw rozkaz wycofania wojsk przed dotarciem ataku do Kolejki rozkazów.",
            "command_type_tooltip": "Rodzaj",
            "slowest_unit_tooltip": "Najwolniejsza jednostka",
            "command_type": "Rodzaj",
            "slowest_unit": "Co?",
            "actions": "Dostępne akcje",
            "no_incoming": "Brak nadchodzących wojsk.",
            "copy": "Kopiuj",
            "current_only_tooltip": "Tylko aktywna wioska",
            "arrive": "Dotrze",
            "arrivetime": "Czas dotarcia skopiowany!",
            "backtime": "Czas powrotu skopiowany!",
            "spyorigin": "Szpiedzy wysłani do %{name}!",
            "commands.tooltip.kill": "Wstaw rozkaz klinowania do Kolejki rozkazów. MAŁY KLIN.",
            "commands.tooltip.killBig": "Wstaw rozkaz klinowania do Kolejki rozkazów. DUŻY KLIN.",
            "commands.tooltip.bunker": "Zabunkruj wioske z wojsk znajdujących się na najbliższych twoich wioskach które zdążą przed atakiem. Uwaga! robisz to na własną odpowiedzialność.",
            "commands.tooltip.spy": "Szpieguj wioske źródłową.",
            "commands.tooltip.withdraw": "Wycofaj wszystkie wsparcia sekundę przed wejsciem tego ataku."
        },
        "auto_collector": {
            "title": "Kolekcjoner",
            "description": "Automatyczny kolekcjoner depozytu/drugiej wioski.",
            "activated": "Kolekcjoner aktywowany",
            "deactivated": "Kolekcjoner deaktywowany"
        },
        "auto_healer": {
            "title": "Medyk",
            "description": "Automatycznie przywraca uzdrowione jednostki ze szpitala.",
            "activated": "Medyk aktywowany",
            "deactivated": "Medyk skończył działanie"
        },
        "builder_queue": {
            "title": "Budowniczy",
            "started": "Budowniczy Uruchomiony",
            "stopped": "Budowniczy Zatrzymany",
            "settings": "Ustawienia",
            "settings_village_groups": "Buduj w wioskach z grupy",
            "settings_building_sequence": "Szablon kolejki budowy",
            "settings_building_sequence_final": "Finalne poziomy budynków",
            "settings_priorize_farm": "Priorytet farmy, jeżeli brakuje prowiantu",
            "settings_saved": "Ustawienia zapisane!",
            "logs_no_builds": "Nie rozpoczęto żadnej rozbudowy",
            "logs_clear": "Wyczyść logi",
            "sequences": "Szablony",
            "sequences_move_up": "Przesuń w górę",
            "sequences_move_down": "Przesuń w dół",
            "sequences_add_building": "Dodaj budynek",
            "sequences_select_edit": "Wybierz szablon do edytowania",
            "sequences_edit_sequence": "Edytuj szablon",
            "select_group": "Wybierz grupę",
            "add_building_success": "%d dodany na pozycji %d",
            "add_building_limit_exceeded": "%d osiągnął/eła maksymalny poziom (%d)",
            "position": "Pozycja",
            "remove_building": "Usuń budynek z listy",
            "clone": "Klonuj",
            "remove_sequence": "Usuń szablon",
            "name_sequence_min_lenght": "Minimalna długość nazwy szablonu",
            "sequence_created": "Nowy szablon %d utworzony.",
            "sequence_updated": "Szablon %d zaktualizowany.",
            "sequence_removed": "Szablon %d usunięty.",
            "error_sequence_exists": "Ten szablon już istnieje.",
            "error_sequence_no_exists": "Ta sekwencja nie istnieje.",
            "error_sequence_invalid": "Niektóre z wartości szablonu są niepoprawne.",
            "logs_cleared": "Logi wyczyszczone.",
            "create_sequence": "Utwórz szablon",
            "settings_preserve_resources": "Zarezerwowane surowce wioski",
            "settings_preserve_wood": "Zabezpiecz drewno",
            "settings_preserve_clay": "Zabezpiecz glinę",
            "settings_preserve_iron": "Zabezpiecz żelazo",
            "discard_changes_title": "Odrzuć zmianę tytułu",
            "discard_changes_text": "Odrzuć zmianę tekstu",
            "clone_warn_changed_sequence_title": "",
            "clone_warn_changed_sequence_text": "",
            "clone_sequence": "Klonuj szablon",
            "amount": "Ilość",
            "empty_sequence": "Pusty szablon",
            "duration": "Czas",
            "info.header": "Tytuł",
            "info.content": "Zawartość"
        },
        "builder_queue_add_building_modal": {
            "title": "Dodaj nowy budynek"
        },
        "builder_queue_name_sequence_modal": {
            "title": "Nazwa szablonu"
        },
        "builder_queue_remove_sequence_modal": {
            "title": "Usuń szablon",
            "text": "Jesteś pewny, że chcesz usunąć ten szablon? Jeśli ten szablon jest teraz aktywny, inny szablon zostanie wybrany i Budowniczy zatrzyma się."
        },
        "command_queue": {
            "title": "Generał",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "sent": "wysłany/e",
            "activated": "włączony",
            "deactivated": "wyłączony",
            "expired": "przedawniony/e",
            "removed": "usunięty/e",
            "added": "dodany/e",
            "general_clear": "Wyczyść logi",
            "general_next_command": "Następny rozkaz",
            "add_basics": "Podstawowe informacje",
            "add_origin": "Źródło",
            "add_selected": "Aktywna wioska",
            "add_target": "Cel",
            "add_map_selected": "Wybrana wioska na mapie",
            "date_type_arrive": "Czas dotarcia na cel",
            "date_type_out": "Czas wyjścia z  twojej wioski",
            "add_current_date": "Obecny czas",
            "add_current_date_plus": "Zwiększ czas o 100 milisekund.",
            "add_current_date_minus": "Zmniejsz czas o 100 milisekund.",
            "add_travel_times": "Czas podróży jednostek",
            "add_date": "Czas/Data",
            "add_no_village": "Wybierz wioskę...",
            "add_village_search": "Znajdź wioskę...",
            "add_clear": "Wyczyść pola",
            "add_insert_preset": "Wybierz szablon",
            "queue_waiting": "Rozkazy",
            "queue_none_added": "Brak dodanych rozkazów.",
            "queue_sent": "Rozkazy wysłane",
            "queue_none_sent": "Brak wysłanych rozkazów.",
            "queue_expired": "Przedawnione rozkazy",
            "queue_none_expired": "Brak przedawnionych rozkazów.",
            "queue_remove": "Usuń rozkaz z listy",
            "queue_filters": "Filtruj rozkazy",
            "filters_selected_village": "Pokaż tylko rozkazy z aktywnej wioski",
            "filters_barbarian_target": "Pokaż tylko rozkazy na wioski barbarzyńskie",
            "filters_attack": "Pokaż ataki",
            "filters_support": "Pokaż wsparcia",
            "filters_relocate": "Pokaż przeniesienia",
            "filters_text_match": "Filtruj za pomocą tekstu...",
            "command_out": "Czas wyjścia",
            "command_time_left": "Pozostały czas",
            "command_arrive": "Czas dotarcia",
            "error_no_units_enough": "Brak wystarczającej liczby jednostek do wysłania rozkazu!",
            "error_not_own_village": "Wioska źródłowa nie należy do ciebie!",
            "error_origin": "Nieprawidłowa wioska źródłowa!",
            "error_target": "Nieprawidłowa wioska cel!",
            "error_no_units": "Nie wybrano jednostek!",
            "error_invalid_date": "Nieprawidłowy Czas",
            "error_already_sent_attack": "Atak %{type} powinien zostać wysłany %{date}",
            "error_already_sent_support": "Wsparcie %{type} powinno zostać wysłane %{date}",
            "error_already_sent_relocate": "Przeniesienie %{type} powinno zostać wysłane %{date}",
            "error_relocate_disabled": "Przeniesienie wojsk wyłączone",
            "error_no_map_selected_village": "Nie zaznaczono wioski na mapie.",
            "error_remove_error": "Błąd usuwania rozkazu.",
            "tab_add": "Dodaj rozkaz",
            "tab_waiting": "Oczekujące",
            "tab_logs": "Logi"
        },
        "farm_overflow": {
            "title": "Farmer",
            "open_report": "Otwórz raport",
            "no_report": "Nie ma raportu",
            "reports": "Raporty",
            "date": "Data",
            "status_time_limit": "Cel jest zbyt daleko",
            "status_command_limit": "Limit poleceń",
            "status_full_storage": "Magazyn jest pełny",
            "status_no_units": "Brak dostępnych jednostek",
            "status_abandoned_conquered": "Porzucone podbicie",
            "status_protected_village": "Cel jest chroniony",
            "status_busy_target": "Cel jest atakowany",
            "status_no_targets": "Brak dostępnych celów",
            "status_target_cycle_end": "Cykl wysyłania zakończony",
            "status_not_allowed_points": "Punkty celu niedozwolone",
            "status_unknown": "Nieznany status",
            "status_attacking": "Atakuje",
            "status_waiting_cycle": "Oczekuje",
            "status_user_stop": "",
            "status_expired_step": "",
            "not_loaded": "Nie załadowany.",
            "ignored_targets": "Ignorowane cele",
            "no_ignored_targets": "Brak ignorowanych",
            "included_targets": "Dodatkowe cele",
            "no_included_targets": "Brak dodatkowych",
            "farmer_villages": "Wioski farmiące",
            "no_farmer_villages": "Brak wiosek farm",
            "last_status": "Status",
            "attacking": "Atakuje.",
            "paused": "Zatrzymany.",
            "command_limit": "Limit 50 ataków osiągnięty, oczekiwanie na powrót wojsk.",
            "last_attack": "Ostatni atak",
            "village_switch": "Przejście do wioski %{village}",
            "no_preset": "Brak dostępnych szablonów.",
            "no_selected_village": "Brak dostępnych wiosek.",
            "no_units": "Brak dostępnych jednostek w wiosce, oczekiwanie na powrót wojsk.",
            "no_units_no_commands": "Brak jednostek w wioskach lub powracających wojsk.",
            "no_villages": "Brak dostępnych wiosek, oczekiwanie na powrót wojsk.",
            "preset_first": "Wybierz najpierw szablon!",
            "selected_village": "Wybrana wioska",
            "loading_targets": "Ładowanie celów...",
            "checking_targets": "Sprawdzanie celów...",
            "restarting_commands": "Restartowanie poleceń...",
            "ignored_village": "Cel %{target} dodany do listy pominiętych.(straty)",
            "included_village": "Cel %{target} dodany do listy zawartych",
            "ignored_village_removed": "usunięty z listy ignorowanych",
            "included_village_removed": "usunięty z listy zawartych",
            "priority_target": "dodany do priorytetowych.",
            "analyse_targets": "Analizowanie celów.",
            "step_cycle_restart": "Restartowanie cyklu poleceń...",
            "step_cycle_end": "Lista wiosek zakończona, oczekiwanie na następny cykl.",
            "step_cycle_end_no_villages": "Brak wiosek do rozpoczęcia cyklu.",
            "step_cycle_next": "Lista wiosek się skończyła, następny cykl: %d.",
            "step_cycle_next_no_villages": "Brak wioski do rozpoczęcia cyklu, następny cykl: %d.",
            "full_storage": "Magazyn w wiosce jest pełny",
            "farm_stopped": "Farmer zatrzymany.",
            "farm_started": "Farmer uruchomiony",
            "groups_presets": "Grupy i szablony",
            "presets": "Szablony",
            "group_ignored": "Pomijaj wioski z grupy",
            "group_include": "Dodaj wioski z grupy",
            "group_only": "Atakuj tylko wioski z grup",
            "attack_interval": "Przerwa między atakami (sekundy)",
            "preserve_command_slots": "Rezerwuj sloty poleceń",
            "target_single_attack": "Zezwól celom na jeden atak per wioska",
            "target_multiple_farmers": "Zezwól celom otrzymywać ataki z kilku wiosek",
            "farmer_cycle_interval": "Przerwa pomiędzy cyklami farmienia (minut)",
            "ignore_on_loss": "Pomijaj cele jeśli straty",
            "ignore_full_storage": "Pomijaj wioski jeśli magazyn pełny",
            "step_cycle_header": "Cykl Farmienia",
            "step_cycle": "Włącz Cykl farmienia",
            "step_cycle_notifs": "Powiadomienia",
            "target_filters": "Filtry celów",
            "min_distance": "Minimalna odległość",
            "max_distance": "Maksymalna odległość",
            "min_points": "Minimalna liczba punktów",
            "max_points": "Maksymalna liczba punktów",
            "max_travel_time": "Maksymalny czas podróży (minuty)",
            "logs_limit": "Maksymalna ilość logów",
            "event_attack": "Logi ataków",
            "event_village_change": "Logi zmiany wiosek",
            "event_priority_add": "Logi celów priorytetowych",
            "event_ignored_village": "Logi pominiętych wiosek",
            "settings_saved": "Ustawienia zapisane!",
            "misc": "Różne",
            "attack": "atakuje",
            "no_logs": "Brak zarejestrowanych logów",
            "clear_logs": "Wyczyść logi",
            "reseted_logs": "Zarejestrowane logi zostały wyczyszczone.",
            "date_added": "Data dodania",
            "multiple_attacks_interval": "Przerwa między atakami (sekundy)",
            "next_cycle_in": "Następny cykl za",
            "target_limit_per_village": "Limit celów na wioskę",
            "settings.hotkeySwitch": "Skrót Start/Pauza",
            "settings.hotkeyWindow": "Skrót okna Farmera",
            "settings.remote": "Sterowanie Zdalne za pomocą wiadomości PW",
            "settingError.minDistance": "Odległość celu musi być większa niż %{min}.",
            "settingError.maxDistance": "Odległość celu nie może przekraczać %{max}.",
            "settingError.maxTravelTime": "Maksymalny czas podróży hh:mm:ss.",
            "settingError.randomBase": "Domyślny odstęp musi być pomiędzy %{min} and %{max}.",
            "settingError.minPoints": "Minimalna liczba punktów celu to %{min}.",
            "settingError.maxPoints": "Maksymalna liczba punktów celu to %{max}.",
            "settingError.eventsLimit": "Liczba zdarzeń musi być wartością między %{min} i %{max}.",
            "langName": "Polski",
            "events.nothingYet": "Odpoczywam...",
            "events.sendCommand": "%{origin} atakuje %{target}",
            "events.priorityTargetAdded": "%{target} dodany do priorytetowych.",
            "general.disabled": "— Wyłączony —",
            "settings.docs": "Miłego farmienia!",
            "settings.settings": "Ustawienia",
            "settings.priorityTargets": "Priorytyzuj cele"
        },
        "minimap": {
            "title": "Minimapa",
            "minimap": "Kartograf",
            "highlights": "Podświetlenie",
            "add": "Dodaj podświetlenie",
            "remove": "Usuń podświetlenie",
            "very_small": "Bardzo mała",
            "small": "Mała",
            "big": "Duża",
            "very_big": "Bardzo duża",
            "placeholder_search": "Szukaj gracz/plemię",
            "highlight_add_success": "Podświetlenie dodane",
            "highlight_add_error": "Najpierw sprecyzuj podświetlenie",
            "highlight_update_success": "Podświetlenie zaktualizowane",
            "highlight_remove_success": "Podświetlenie usunięte",
            "highlight_villages": "Wioski",
            "highlight_players": "Gracze",
            "highlight_tribes": "Plemiona",
            "highlight_add_error_exists": "Podświetlenie już istnieje!",
            "highlight_add_error_no_entry": "Najpierw wybierz gracza/plemię!",
            "highlight_add_error_invalid_color": "Nieprawidłowy kolor!",
            "village": "Wioska",
            "player": "Gracz",
            "tribe": "Plemię",
            "color": "Kolor (Hex)",
            "tooltip_pick_color": "Wybierz kolor",
            "misc": "Pozostałe ustawienia",
            "colors_misc": "Różne kolory",
            "colors_diplomacy": "Dyplomacja - kolory",
            "settings_saved": "Ustawienia zapisane!",
            "settings_map_size": "Rozmiar mapy",
            "settings_right_click_action": "PPM aby wykonać działanie na wiosce",
            "highlight_village": "Podświetl wioskę",
            "highlight_player": "Podświetl gracza",
            "highlight_tribe": "Podświetl plemie",
            "settings_show_floating_minimap": "Pokaż ruchomą mapę",
            "settings_show_view_reference": "Pokaż wskaźnik obecnej pozycji",
            "settings_show_continent_demarcations": "Pokaż granice królestw",
            "settings_show_province_demarcations": "Pokaż granice prowincji",
            "settings_show_barbarians": "Pokaż wioski barbarzyńskie",
            "settings_show_ghost_villages": "Pokaż niezaładowane wioski",
            "settings_show_only_custom_highlights": "Pokaż tylko własne podświetlenia",
            "settings_highlight_own": "Podświetl własne wioski",
            "settings_highlight_selected": "Podświetl wybraną wioskę",
            "settings_highlight_diplomacy": "Automatycznie podświetl plemienną dyplomację",
            "settings_colors_background": "Tło minimapy",
            "settings_colors_province": "Granica prowincji",
            "settings_colors_continent": "Granica królestwa",
            "settings_colors_quick_highlight": "Szybkie podświetlenie",
            "settings_colors_tribe": "Własne plemie",
            "settings_colors_player": "Własne wioski",
            "settings_colors_selected": "Wybrana wioska",
            "settings_colors_ghost": "Niezaładowana wioska",
            "settings_colors_ally": "Sojusznik",
            "settings_colors_pna": "PON",
            "settings_colors_enemy": "Wróg",
            "settings_colors_other": "Pozostałe wioski graczy",
            "settings_colors_barbarian": "Wioski barbarzyńskie",
            "settings_colors_view_reference": "Wskaźnik obecnej pozycji",
            "settings_reset": "Ustawienia zresetowane",
            "tooltip_village": "Wioska",
            "tooltip_village_points": "Punkty wioski",
            "tooltip_player": "Nazwa gracza",
            "tooltip_player_points": "Punkty gracza",
            "tooltip_tribe": "Plemię",
            "tooltip_tribe_points": "Punkty plemienia",
            "tooltip_province": "Prowincja",
            "no_highlights": "Brak utworzonych podświetleń",
            "reset_confirm_title": "Resetuj ustawienia",
            "reset_confirm_text": "Wszystkie ustawienia zostaną przywrócone do domyślnych.",
            "reset_confirm_highlights_text": "Jak również wszystkie podświetlenia zostaną usunięte.",
            "default_village_colors_info": "Informacje o domyślnych kolorach wiosek",
            "entry/id": "Wioska/gracz/plemie",
            "tooltip.village-id": "Id wioski",
            "tooltip.player-id": "Id gracza",
            "tooltip.tribe-id": "Id plemienia"
        },
        "common": {
            "start": "Start",
            "started": "Uruchomiony",
            "pause": "Pauza",
            "paused": "Wstrzymany",
            "stop": "Zatrzymany",
            "stopped": "Zatrzymany",
            "status": "Status",
            "none": "Żaden",
            "info": "Informacje",
            "settings": "Ustawienia",
            "others": "Inne",
            "village": "Wioska",
            "villages": "Wioski",
            "building": "Budynek",
            "buildings": "Budynki",
            "level": "Poziom",
            "registers": "Rejestry",
            "filters": "Filtry",
            "add": "Dodaj",
            "waiting": "Oczekujące",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "activate": "Aktywuj",
            "deactivate": "Wyłącz",
            "units": "Jednostki",
            "officers": "Oficerowie",
            "origin": "Źródło",
            "target": [
                "Cel",
                "Cele"
            ],
            "save": "Zapisz",
            "logs": "Logi",
            "no-results": "Brak wyników...",
            "selected": "Wybrana",
            "now": "Teraz",
            "costs": "Koszty",
            "duration": "Czas",
            "points": "Punkty",
            "player": "Gracz",
            "players": "Gracze",
            "next_features": "Następne funkcje",
            "misc": "Różne",
            "colors": "Kolory",
            "reset": "Resetuj",
            "here": "tutaj",
            "disabled": "— Wyłączony —",
            "cancel": "Anuluj",
            "actions": "Akcje",
            "remove": "Usuń",
            "started_at": "Uruchomiony",
            "arrive": "Dotarcie",
            "settings_saved": "Ustawienia zapisane",
            "discard": "Odrzuć",
            "new_version": "Nowa wersja",
            "check_changes": "Sprawdź zmiany",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "firefox_shill": ""
        }
    },
    "pl_pl": {
        "about": {
            "contact": "Kontakt",
            "email": "Email",
            "links": "Linki projektów",
            "source_code": "Kod źródłowy",
            "issues_suggestions": "Błędy/sugestie",
            "translations": "Tłumaczenia"
        },
        "attack_view": {
            "title": "Strażnik",
            "filter_types": "Rodzaj",
            "filter_show_attacks_tooltip": "Pokaż ataki",
            "filter_show_supports_tooltip": "Pokaż wsparcia",
            "filter_show_relocations_tooltip": "Pokaż przeniesienia",
            "filter_incoming_units": "Nadchodzące jednostki",
            "commands_copy_arrival_tooltip": "Kopiuj czas dotarcia.",
            "commands_copy_backtime_tooltip": "Kopiuj czas powrotu do wioski źródłowej.",
            "commands_set_remove_tooltip": "Wstaw rozkaz wycofania wojsk przed dotarciem ataku do Kolejki rozkazów.",
            "command_type_tooltip": "Rodzaj",
            "slowest_unit_tooltip": "Najwolniejsza jednostka",
            "command_type": "Rodzaj",
            "slowest_unit": "Co?",
            "actions": "Dostępne akcje",
            "no_incoming": "Brak nadchodzących wojsk.",
            "copy": "Kopiuj",
            "current_only_tooltip": "Tylko aktywna wioska",
            "arrive": "Dotrze",
            "arrivetime": "Czas dotarcia skopiowany!",
            "backtime": "Czas powrotu skopiowany!",
            "spyorigin": "Szpiedzy wysłani do %{name}!",
            "commands.tooltip.kill": "Wstaw rozkaz klinowania do Kolejki rozkazów. MAŁY KLIN.",
            "commands.tooltip.killBig": "Wstaw rozkaz klinowania do Kolejki rozkazów. DUŻY KLIN.",
            "commands.tooltip.bunker": "Zabunkruj wioske z wojsk znajdujących się na najbliższych twoich wioskach które zdążą przed atakiem. Uwaga! robisz to na własną odpowiedzialność.",
            "commands.tooltip.spy": "Szpieguj wioske źródłową.",
            "commands.tooltip.withdraw": "Wycofaj wszystkie wsparcia sekundę przed wejsciem tego ataku."
        },
        "auto_collector": {
            "title": "Kolekcjoner",
            "description": "Automatyczny kolekcjoner depozytu/drugiej wioski.",
            "activated": "Kolekcjoner aktywowany",
            "deactivated": "Kolekcjoner deaktywowany"
        },
        "auto_healer": {
            "title": "Medyk",
            "description": "Automatycznie przywraca uzdrowione jednostki ze szpitala.",
            "activated": "Medyk aktywowany",
            "deactivated": "Medyk skończył działanie"
        },
        "builder_queue": {
            "title": "Budowniczy",
            "started": "BuilderQueue Uruchomiony",
            "stopped": "BuilderQueue Zatrzymany",
            "settings": "Ustawienia",
            "settings_village_groups": "Buduj w wioskach z grupy",
            "settings_building_sequence": "Szablon kolejki budowy",
            "settings_building_sequence_final": "Finalne poziomy budynków",
            "settings_priorize_farm": "Priorytet farmy, jeżeli brakuje prowiantu",
            "settings_saved": "Ustawienia zapisane!",
            "logs_no_builds": "Nie rozpoczęto żadnej rozbudowy",
            "logs_clear": "Wyczyść logi",
            "sequences": "Szablony",
            "sequences_move_up": "Przesuń w górę",
            "sequences_move_down": "Przesuń w dół",
            "sequences_add_building": "Dodaj budynek",
            "sequences_select_edit": "Wybierz szablon do edytowania",
            "sequences_edit_sequence": "Edytuj szablon",
            "select_group": "Wybierz grupę",
            "add_building_success": "%d dodany na pozycji %d",
            "add_building_limit_exceeded": "%d osiągnął/eła maksymalny poziom (%d)",
            "position": "Pozycja",
            "remove_building": "Usuń budynek z listy",
            "clone": "Klonuj",
            "remove_sequence": "Usuń szablon",
            "name_sequence_min_lenght": "Minimalna długość nazwy szablonu",
            "sequence_created": "Nowy szablon %d utworzony.",
            "sequence_updated": "Szablon %d zaktualizowany.",
            "sequence_removed": "Szablon %d usunięty.",
            "error_sequence_exists": "Ten szablon już istnieje.",
            "error_sequence_no_exists": "Ta sekwencja nie istnieje.",
            "error_sequence_invalid": "Niektóre z wartości szablonu są niepoprawne.",
            "logs_cleared": "Logi wyczyszczone.",
            "create_sequence": "Utwórz szablon",
            "settings_preserve_resources": "Zarezerwowane surowce wioski",
            "settings_preserve_wood": "Zabezpiecz drewno",
            "settings_preserve_clay": "Zabezpiecz glinę",
            "settings_preserve_iron": "Zabezpiecz żelazo",
            "discard_changes_title": "Odrzuć zmianę tytułu",
            "discard_changes_text": "Odrzuć zmianę tekstu",
            "clone_warn_changed_sequence_title": "",
            "clone_warn_changed_sequence_text": "",
            "clone_sequence": "Klonuj szablon",
            "amount": "Ilość",
            "empty_sequence": "Pusty szablon",
            "duration": "Czas",
            "info.header": "Tytuł",
            "info.content": "Zawartość"
        },
        "builder_queue_add_building_modal": {
            "title": "Dodaj nowy budynek"
        },
        "builder_queue_name_sequence_modal": {
            "title": "Nazwa szablonu"
        },
        "builder_queue_remove_sequence_modal": {
            "title": "Usuń szablon",
            "text": "Jesteś pewny, że chcesz usunąć ten szablon? Jeśli ten szablon jest teraz aktywny, inny szablon zostanie wybrany i BuilderQueue zatrzyma się."
        },
        "command_queue": {
            "title": "Generał",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "przenieś",
            "sent": "wysłany/e",
            "activated": "włączony",
            "deactivated": "wyłączony",
            "expired": "przedawniony/e",
            "removed": "usunięty/e",
            "added": "dodany/e",
            "general_clear": "Wyczyść logi",
            "general_next_command": "Następny rozkaz",
            "add_basics": "Podstawowe informacje",
            "add_origin": "Źródło",
            "add_selected": "Aktywna wioska",
            "add_target": "Cel",
            "add_map_selected": "Wybrana wioska na mapie",
            "date_type_arrive": "Czas dotarcia na cel",
            "date_type_out": "Czas wyjścia z  twojej wioski",
            "add_current_date": "Obecny czas",
            "add_current_date_plus": "Zwiększ czas o 100 milisekund.",
            "add_current_date_minus": "Zmniejsz czas o 100 milisekund.",
            "add_travel_times": "Czas podróży jednostek",
            "add_date": "Czas/Data",
            "add_no_village": "Wybierz wioskę...",
            "add_village_search": "Znajdź wioskę...",
            "add_clear": "wyczyść",
            "add_insert_preset": "Wybierz szablon",
            "queue_waiting": "Rozkazy",
            "queue_none_added": "Brak dodanych rozkazów.",
            "queue_sent": "Rozkazy wysłane",
            "queue_none_sent": "Brak wysłanych rozkazów.",
            "queue_expired": "Przedawnione rozkazy",
            "queue_none_expired": "Brak przedawnionych rozkazów.",
            "queue_remove": "Usuń rozkaz z listy",
            "queue_filters": "Filtruj rozkazy",
            "filters_selected_village": "Pokaż tylko rozkazy z aktywnej wioski",
            "filters_barbarian_target": "Pokaż tylko rozkazy na wioski barbarzyńskie",
            "filters_attack": "Pokaż ataki",
            "filters_support": "Pokaż wsparcia",
            "filters_relocate": "Pokaż przeniesienia",
            "filters_text_match": "Filtruj za pomocą tekstu...",
            "command_out": "Czas wyjścia",
            "command_time_left": "Pozostały czas",
            "command_arrive": "Czas dotarcia",
            "error_no_units_enough": "Brak wystarczającej liczby jednostek do wysłania rozkazu!",
            "error_not_own_village": "Wioska źródłowa nie należy do ciebie!",
            "error_origin": "Nieprawidłowa wioska źródłowa!",
            "error_target": "Nieprawidłowa wioska cel!",
            "error_no_units": "Nie wybrano jednostek!",
            "error_invalid_date": "Nieprawidłowy Czas",
            "error_already_sent_attack": "Atak %{type} powinien zostać wysłany %{date}",
            "error_already_sent_support": "Wsparcie %{type} powinno zostać wysłane %{date}",
            "error_already_sent_relocate": "Przeniesienie %{type} powinno zostać wysłane %{date}",
            "error_relocate_disabled": "Przeniesienie wojsk wyłączone",
            "error_no_map_selected_village": "Nie zaznaczono wioski na mapie.",
            "error_remove_error": "Błąd usuwania rozkazu.",
            "tab_add": "Dodaj rozkaz",
            "tab_waiting": "Oczekujące",
            "tab_logs": "Logi"
        },
        "farm_overflow": {
            "title": "Farmer",
            "open_report": "Otwórz raport",
            "no_report": "Nie ma raportu",
            "reports": "Raporty",
            "date": "Data",
            "status_time_limit": "Cel jest zbyt daleko",
            "status_command_limit": "Limit poleceń",
            "status_full_storage": "Magazyn jest pełen",
            "status_no_units": "Brak dostępnych jednostek",
            "status_abandoned_conquered": "Porzucone podbicie",
            "status_protected_village": "Cel jest chroniony",
            "status_busy_target": "Cel jest atakowany",
            "status_no_targets": "Brak dostępnych celów",
            "status_target_cycle_end": "Cykl celów zakończony",
            "status_not_allowed_points": "Punkty celu niedozwolone",
            "status_unknown": "Nieznany status",
            "status_attacking": "Attakuje",
            "status_waiting_cycle": "Cykl czekania",
            "status_user_stop": "",
            "status_expired_step": "",
            "not_loaded": "Nie załadowany.",
            "ignored_targets": "Ignorowane cele",
            "no_ignored_targets": "Brak ignorowanych",
            "included_targets": "Zawarte cele",
            "no_included_targets": "Brak zawartych",
            "farmer_villages": "Wioski farmy",
            "no_farmer_villages": "Brak wiosek farm",
            "last_status": "Ostatni status",
            "attacking": "Atakuje.",
            "paused": "Zatrzymany.",
            "command_limit": "Limit 50 ataków osiągnięty, oczekiwanie na powrót wojsk.",
            "last_attack": "Ostatni atak",
            "village_switch": "Przejście do wioski",
            "no_preset": "Brak dostępnych szablonów.",
            "no_selected_village": "Brak dostępnych wiosek.",
            "no_units": "Brak dostępnych jednostek w wiosce, oczekiwanie na powrót wojsk.",
            "no_units_no_commands": "Brak jednostek w wioskach lub powracających wojsk.",
            "no_villages": "Brak dostępnych wiosek, oczekiwanie na powrót wojsk.",
            "preset_first": "Wybierz najpierw szablon!",
            "selected_village": "Wybrana wioska",
            "loading_targets": "Ładowanie celów...",
            "checking_targets": "Sprawdzanie celów...",
            "restarting_commands": "Restartowanie poleceń...",
            "ignored_village": "dodany do listy pominiętych",
            "included_village": "dodany do listy zawartych",
            "ignored_village_removed": "usunięty z listy ignorowanych",
            "included_village_removed": "usunięty z listy zawartych",
            "priority_target": "dodany do priorytetowych.",
            "analyse_targets": "Analizowanie celów.",
            "step_cycle_restart": "Restartowanie cyklu poleceń...",
            "step_cycle_end": "Lista wiosek zakończona, oczekiwanie na następny cykl.",
            "step_cycle_end_no_villages": "Brak wiosek do rozpoczęcia cyklu.",
            "step_cycle_next": "Lista wiosek się skończyła, następny cykl: %d.",
            "step_cycle_next_no_villages": "Brak wioski do rozpoczęcia cyklu, następny cykl: %d.",
            "full_storage": "Magazyn w wiosce jest pełny",
            "farm_stopped": "FarmOverflow zatrzymany.",
            "farm_started": "Farmer uruchomiony",
            "groups_presets": "Grupy i szablony",
            "presets": "Szablony",
            "group_ignored": "Pomijaj wioski z grupy",
            "group_include": "Dodaj wioski z grupy",
            "group_only": "Atakuj tylko wioski z grup",
            "attack_interval": "Przerwa między atakami",
            "preserve_command_slots": "Rezerwuj sloty poleceń",
            "target_single_attack": "Zezwól celom na jeden atak per wioska",
            "target_multiple_farmers": "Zezwól celom otrzymywać ataki z kilku wiosek",
            "farmer_cycle_interval": "Przerwa pomiędzy cyklami farmienia (minut)",
            "ignore_on_loss": "Pomijaj cele jeśli straty",
            "ignore_full_storage": "Pomijaj wioski jeśli magazyn pełny",
            "step_cycle_header": "Cykl Farmienia",
            "step_cycle": "Włącz Cykl farmienia",
            "step_cycle_notifs": "Powiadomienia",
            "target_filters": "Filtry celów",
            "min_distance": "Minimalna odległość",
            "max_distance": "Maksymalna odległość",
            "min_points": "Minimalna liczba punktów",
            "max_points": "Maksymalna liczba punktów",
            "max_travel_time": "Maksymalny czas podróży (minuty)",
            "logs_limit": "Maksymalna ilość wpisów logów",
            "event_attack": "Logi ataków",
            "event_village_change": "Logi zmiany wiosek",
            "event_priority_add": "Logi celów priorytetowych",
            "event_ignored_village": "Logi pominiętych wiosek",
            "settings_saved": "Ustawienia zapisane!",
            "misc": "Różne",
            "attack": "atakuje",
            "no_logs": "Brak zarejestrowanych logów",
            "clear_logs": "Wyczyść logi",
            "reseted_logs": "Zarejestrowane logi zostały wyczyszczone.",
            "date_added": "Data dodania",
            "multiple_attacks_interval": "Przerwa między atakami (sekundy)",
            "next_cycle_in": "Następny cykl za",
            "target_limit_per_village": "Limit celów na wioskę",
            "settings.hotkeySwitch": "Skrót Start/Pauza",
            "settings.hotkeyWindow": "Skrót okna Farmera",
            "settings.remote": "Sterowanie Zdalne za pomocą wiadomości PW",
            "settingError.minDistance": "Odległość celu musi być większa niż %{min}.",
            "settingError.maxDistance": "Odległość celu nie może przekraczać %{max}.",
            "settingError.maxTravelTime": "Maksymalny czas podróży hh:mm:ss.",
            "settingError.randomBase": "Domyślny odstęp musi być pomiędzy %{min} and %{max}.",
            "settingError.minPoints": "Minimalna liczba punktów celu to %{min}.",
            "settingError.maxPoints": "Maksymalna liczba punktów celu to %{max}.",
            "settingError.eventsLimit": "Liczba zdarzeń musi być wartością między %{min} i %{max}.",
            "langName": "Polski",
            "events.nothingYet": "Odpoczywam...",
            "events.sendCommand": "%{origin} atakuje %{target}",
            "events.priorityTargetAdded": "%{target} dodany do priorytetowych.",
            "general.disabled": "— Wyłączony —",
            "settings.docs": "Miłego farmienia!",
            "settings.settings": "Ustawienia",
            "settings.priorityTargets": "Priorytyzuj cele"
        },
        "minimap": {
            "title": "Minimapa",
            "minimap": "Kartograf",
            "highlights": "Podświetlenie",
            "add": "Dodaj podświetlenie",
            "remove": "Usuń podświetlenie",
            "very_small": "Bardzo mała",
            "small": "Mała",
            "big": "Duża",
            "very_big": "Bardzo duża",
            "placeholder_search": "Szukaj gracz/plemię",
            "highlight_add_success": "Podświetlenie dodane",
            "highlight_add_error": "Najpierw sprecyzuj podświetlenie",
            "highlight_update_success": "Podświetlenie zaktualizowane",
            "highlight_remove_success": "Podświetlenie usunięte",
            "highlight_villages": "Wioski",
            "highlight_players": "Gracze",
            "highlight_tribes": "Plemiona",
            "highlight_add_error_exists": "Podświetlenie już istnieje!",
            "highlight_add_error_no_entry": "Najpierw wybierz gracza/plemię!",
            "highlight_add_error_invalid_color": "Nieprawidłowy kolor!",
            "village": "Wioska",
            "player": "Gracz",
            "tribe": "Plemię",
            "color": "Kolor (Hex)",
            "tooltip_pick_color": "Wybierz kolor",
            "misc": "Pozostałe ustawienia",
            "colors_misc": "Różne kolory",
            "colors_diplomacy": "Dyplomacja - kolory",
            "settings_saved": "Ustawienia zapisane!",
            "settings_map_size": "Rozmiar mapy",
            "settings_right_click_action": "PPM aby wykonać działanie na wiosce",
            "highlight_village": "Podświetl wioskę",
            "highlight_player": "Podświetl gracza",
            "highlight_tribe": "Podświetl plemie",
            "settings_show_floating_minimap": "Pokaż ruchomą mapę",
            "settings_show_view_reference": "Pokaż wskaźnik obecnej pozycji",
            "settings_show_continent_demarcations": "Pokaż granice królestw",
            "settings_show_province_demarcations": "Pokaż granice prowincji",
            "settings_show_barbarians": "Pokaż wioski barbarzyńskie",
            "settings_show_ghost_villages": "Pokaż niezaładowane wioski",
            "settings_show_only_custom_highlights": "Pokaż tylko własne podświetlenia",
            "settings_highlight_own": "Podświetl własne wioski",
            "settings_highlight_selected": "Podświetl wybraną wioskę",
            "settings_highlight_diplomacy": "Automatycznie podświetl plemienną dyplomację",
            "settings_colors_background": "Tło minimapy",
            "settings_colors_province": "Granica prowincji",
            "settings_colors_continent": "Granica kontynentu",
            "settings_colors_quick_highlight": "Szybkie podświetlenie",
            "settings_colors_tribe": "Własne plemie",
            "settings_colors_player": "Własne wioski",
            "settings_colors_selected": "Wybrana wioska",
            "settings_colors_ghost": "Niezaładowana wioska",
            "settings_colors_ally": "Sojusznik",
            "settings_colors_pna": "PON",
            "settings_colors_enemy": "Wróg",
            "settings_colors_other": "Pozostałe wioski graczy",
            "settings_colors_barbarian": "Wioski barbarzyńskie",
            "settings_colors_view_reference": "Wskaźnik obecnej pozycji",
            "settings_reset": "Ustawienia zresetowane",
            "tooltip_village": "Wioska",
            "tooltip_village_points": "Punkty wioski",
            "tooltip_player": "Nazwa gracza",
            "tooltip_player_points": "Punkty gracza",
            "tooltip_tribe": "Plemię",
            "tooltip_tribe_points": "Punkty plemienia",
            "tooltip_province": "Prowincja",
            "no_highlights": "Brak utworzonych podświetleń",
            "reset_confirm_title": "Resetuj ustawienia",
            "reset_confirm_text": "Wszystkie ustawienia zostaną przywrócone do domyślnych.",
            "reset_confirm_highlights_text": "Jak również wszystkie podświetlenia zostaną usunięte.",
            "default_village_colors_info": "Informacje o domyślnych kolorach wiosek",
            "entry/id": "Wioska/gracz/plemie",
            "tooltip.village-id": "Id wioski",
            "tooltip.player-id": "Id gracza",
            "tooltip.tribe-id": "Id plemienia"
        },
        "common": {
            "start": "Start",
            "started": "Uruchomiony",
            "pause": "Pauza",
            "paused": "Wstrzymany",
            "stop": "Zatrzymany",
            "stopped": "Zatrzymany",
            "status": "Status",
            "none": "Żaden",
            "info": "Informacje",
            "settings": "Ustawienia",
            "others": "Inne",
            "village": "Wioska",
            "villages": "Wioski",
            "building": "Budynek",
            "buildings": "Budynki",
            "level": "Poziom",
            "registers": "Logi",
            "filters": "Filtry",
            "add": "Dodaj",
            "waiting": "Oczekujące",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "activate": "Aktywuj",
            "deactivate": "Wyłącz",
            "units": "Jednostki",
            "officers": "Oficerowie",
            "origin": "Źródło",
            "target": [
                "Cel",
                "Cele"
            ],
            "save": "Zapisz",
            "logs": "Logi",
            "no-results": "Brak wyników...",
            "selected": "Wybrana",
            "now": "Teraz",
            "costs": "Koszty",
            "duration": "Czas trwania",
            "points": "Punkty",
            "player": "Gracz",
            "players": "Gracze",
            "next_features": "Następne funkcje",
            "misc": "Różne",
            "colors": "Kolory",
            "reset": "Resetuj",
            "here": "tutaj",
            "disabled": "— Wyłączony —",
            "cancel": "Anuluj",
            "actions": "Akcje",
            "remove": "Usuń",
            "started_at": "Uruchomiony",
            "arrive": "Dotarcie",
            "settings_saved": "Ustawienia zapisane",
            "discard": "Odrzuć",
            "new_version": "Nowa wersja",
            "check_changes": "Sprawdź zmiany",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "firefox_shill": ""
        }
    }
} // eslint-disable-line
    const DEFAULT_LANG = 'en_us'
    const SHARED_LANGS = {
        'en_dk': 'en_us',
        'pt_pt': 'pt_br'
    }

    function selectLanguage (langId) {
        langId = hasOwn.call(SHARED_LANGS, langId) ? SHARED_LANGS[langId] : langId
        i18n.setJSON(languages[langId] || languages[DEFAULT_LANG])
    }

    let twoLanguage = {}

    twoLanguage.init = function () {
        if (initialized) {
            return false
        }

        initialized = true
        
        selectLanguage($rootScope.loc.ale)

        // trigger eventTypeProvider.LANGUAGE_SELECTED_CHANGED you dumb fucks
        $rootScope.$watch('loc.ale', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                selectLanguage($rootScope.loc.ale)
            }
        })
    }

    return twoLanguage
})

define('two/Settings', [
    'two/utils',
    'Lockr'
], function (
    utils,
    Lockr
) {
    const generateDiff = function (before, after) {
        let changes = {}

        for (let id in before) {
            if (hasOwn.call(after, id)) {
                if (!angular.equals(before[id], after[id])) {
                    changes[id] = after[id]
                }
            } else {
                changes[id] = before[id]
            }
        }

        return angular.equals({}, changes) ? false : changes
    }

    const generateDefaults = function (map) {
        let defaults = {}

        for (let key in map) {
            defaults[key] = map[key].default
        }

        return defaults
    }

    const disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', $rootScope.loc.ale, 'common'),
            value: false
        }
    }

    const getUpdates = function (map, changes) {
        let updates = {}

        for (let id in changes) {
            (map[id].updates || []).forEach(function (updateItem) {
                updates[updateItem] = true
            })
        }

        if (angular.equals(updates, {})) {
            return false
        }

        return updates
    }

    let Settings = function (configs) {
        this.settingsMap = configs.settingsMap
        this.storageKey = configs.storageKey
        this.defaults = generateDefaults(this.settingsMap)
        this.settings = angular.merge({}, this.defaults, Lockr.get(this.storageKey, {}))
        this.events = {
            settingsChange: configs.onChange || noop
        }
        this.injected = false
    }

    Settings.prototype.get = function (id) {
        return angular.copy(this.settings[id])
    }

    Settings.prototype.getAll = function () {
        return angular.copy(this.settings)
    }

    Settings.prototype.getDefault = function (id) {
        return hasOwn.call(this.defaults, id) ? this.defaults[id] : undefined
    }

    Settings.prototype.store = function () {
        Lockr.set(this.storageKey, this.settings)
    }

    Settings.prototype.set = function (id, value, opt) {
        if (!hasOwn.call(this.settingsMap, id)) {
            return false
        }

        const map = this.settingsMap[id]
        
        if (map.inputType === 'number') {
            value = parseInt(value, 10)

            if (hasOwn.call(map, 'min')) {
                value = Math.max(map.min, value)
            }

            if (hasOwn.call(map, 'max')) {
                value = Math.min(map.max, value)
            }
        }

        const before = angular.copy(this.settings)
        this.settings[id] = value
        const after = angular.copy(this.settings)
        const changes = generateDiff(before, after)

        if (!changes) {
            return false
        }

        const updates = getUpdates(this.settingsMap, changes)

        this.store()
        this.updateScope()
        this.events.settingsChange.call(this, changes, updates, opt || {})

        return true
    }

    Settings.prototype.setAll = function (values, opt) {
        const before = angular.copy(this.settings)

        for (let id in values) {
            if (hasOwn.call(this.settingsMap, id)) {
                const map = this.settingsMap[id]
                let value = values[id]

                if (map.inputType === 'number') {
                    value = parseInt(value, 10)

                    if (hasOwn.call(map, 'min')) {
                        value = Math.max(map.min, value)
                    }

                    if (hasOwn.call(map, 'max')) {
                        value = Math.min(map.max, value)
                    }
                }

                this.settings[id] = value
            }
        }

        const after = angular.copy(this.settings)
        const changes = generateDiff(before, after)

        if (!changes) {
            return false
        }

        const updates = getUpdates(this.settingsMap, changes)

        this.store()
        this.updateScope()
        this.events.settingsChange.call(this, changes, updates, opt || {})

        return true
    }

    Settings.prototype.reset = function (id, opt) {
        this.set(id, this.defaults[id], opt)

        return true
    }

    Settings.prototype.resetAll = function (opt) {
        this.setAll(angular.copy(this.defaults), opt)

        return true
    }

    Settings.prototype.each = function (callback) {
        for (let id in this.settings) {
            if (!hasOwn.call(this.settingsMap, id)) {
                continue
            }
            
            let map = this.settingsMap[id]

            if (map.inputType === 'checkbox') {
                callback.call(this, id, !!this.settings[id], map)
            } else {
                callback.call(this, id, this.settings[id], map)
            }
        }
    }

    Settings.prototype.onChange = function (callback) {
        if (typeof callback === 'function') {
            this.events.settingsChange = callback
        }
    }

    Settings.prototype.injectScope = function ($scope, opt) {
        this.injected = {
            $scope: $scope,
            opt: opt
        }

        $scope.settings = this.encode(opt)

        utils.each(this.settingsMap, function (map, id) {
            if (map.inputType === 'select') {
                $scope.$watch(function () {
                    return $scope.settings[id]
                }, function (value) {
                    if (map.multiSelect) {
                        if (!value.length) {
                            $scope.settings[id] = [disabledOption()]
                        }
                    } else if (!value) {
                        $scope.settings[id] = disabledOption()
                    }
                }, true)
            }
        })
    }

    Settings.prototype.updateScope = function () {
        if (!this.injected) {
            return false
        }

        this.injected.$scope.settings = this.encode(this.injected.opt)
    }

    Settings.prototype.encode = function (opt) {
        let encoded = {}
        const presets = modelDataService.getPresetList().getPresets()
        const groups = modelDataService.getGroupList().getGroups()

        opt = opt || {}

        this.each(function (id, value, map) {
            if (map.inputType === 'select') {
                if (!value && map.disabledOption) {
                    encoded[id] = map.multiSelect ? [disabledOption()] : disabledOption()
                    return
                }

                switch (map.type) {
                    case 'presets': {
                        if (map.multiSelect) {
                            let multiValues = []

                            value.forEach(function (presetId) {
                                if (!presets[presetId]) {
                                    return
                                }

                                multiValues.push({
                                    name: presets[presetId].name,
                                    value: presetId
                                })
                            })

                            encoded[id] = multiValues.length ? multiValues : [disabledOption()]
                        } else {
                            if (!presets[value] && map.disabledOption) {
                                encoded[id] = disabledOption()
                                return
                            }

                            encoded[id] = {
                                name: presets[value].name,
                                value: value
                            }
                        }

                        break
                    }
                    case 'groups': {
                        if (map.multiSelect) {
                            let multiValues = []

                            value.forEach(function (groupId) {
                                if (!groups[groupId]) {
                                    return
                                }

                                multiValues.push({
                                    name: groups[groupId].name,
                                    value: groupId,
                                    leftIcon: groups[groupId].icon
                                })
                            })

                            encoded[id] = multiValues.length ? multiValues : [disabledOption()]
                        } else {
                            if (!groups[value] && map.disabledOption) {
                                encoded[id] = disabledOption()
                                return
                            }

                            encoded[id] = {
                                name: groups[value].name,
                                value: value
                            }
                        }

                        break
                    }
                    default: {
                        encoded[id] = {
                            name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                            value: value
                        }

                        if (opt.multiSelect) {
                            encoded[id] = [encoded[id]]
                        }

                        break
                    }
                }
            } else {
                encoded[id] = value
            }
        })

        return encoded
    }

    Settings.prototype.decode = function (encoded) {
        let decoded = {}

        for (let id in encoded) {
            let map = this.settingsMap[id]

            if (map.inputType === 'select') {
                if (map.multiSelect) {
                    if (encoded[id].length === 1 && encoded[id][0].value === false) {
                        decoded[id] = []
                    } else {
                        let multiValues = []

                        encoded[id].forEach(function (item) {
                            multiValues.push(item.value)
                        })

                        decoded[id] = multiValues
                    }
                } else {
                    decoded[id] = encoded[id].value
                }
            } else {
                decoded[id] = encoded[id]
            }
        }

        return decoded
    }

    Settings.encodeList = function (list, opt) {
        let encoded = []

        opt = opt || {}

        if (opt.disabled) {
            encoded.push(disabledOption())
        }

        switch (opt.type) {
            case 'keys': {
                for (let prop in list) {
                    encoded.push({
                        name: prop,
                        value: prop
                    })
                }

                break
            }
            case 'groups': {
                for (let prop in list) {
                    let value = list[prop]

                    encoded.push({
                        name: value.name,
                        value: value.id,
                        leftIcon: value.icon
                    })
                }

                break
            }
            case 'presets': {
                for (let prop in list) {
                    let value = list[prop]

                    encoded.push({
                        name: value.name,
                        value: value.id
                    })
                }

                break
            }
            case 'values':
            default: {
                for (let prop in list) {
                    let value = list[prop]

                    encoded.push({
                        name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                        value: value
                    })
                }
            }
        }

        return encoded
    }

    Settings.disabledOption = disabledOption

    return Settings
})

define('two/mapData', [
    'conf/conf'
], function (
    conf
) {
    let villages = []
    let grid = []
    let loading = false
    let loaded = false
    let callbackQueue = []
    const MINIMAP_WIDTH = 306
    const MINIMAP_HEIGHT = 306

    angular.extend(eventTypeProvider, {
        MAP_DATA_LOADED: 'map_data_loaded'
    })

    const init = function () {
        const xChunks = Math.ceil(conf.MAP_SIZE / MINIMAP_WIDTH)
        const yChunks = Math.ceil(conf.MAP_SIZE / MINIMAP_HEIGHT)

        for (let gridX = 0; gridX < xChunks; gridX++) {
            grid.push([])

            let chunkX = MINIMAP_WIDTH * gridX
            let chunkWidth = MINIMAP_WIDTH.bound(0, chunkX + MINIMAP_WIDTH).bound(0, conf.MAP_SIZE - chunkX)
            chunkX = chunkX.bound(0, conf.MAP_SIZE)

            for (let gridY = 0; gridY < yChunks; gridY++) {
                let chunkY = MINIMAP_HEIGHT * gridY
                let chunkHeight = MINIMAP_HEIGHT.bound(0, chunkY + MINIMAP_HEIGHT).bound(0, conf.MAP_SIZE - chunkY)
                chunkY = chunkY.bound(0, conf.MAP_SIZE)

                grid[gridX].push({
                    x: chunkX,
                    y: chunkY,
                    width: chunkWidth,
                    height: chunkHeight
                })
            }
        }
    }

    let twoMapData = {}

    twoMapData.load = function (callback = noop, force) {
        if (force) {
            loaded = false
        } else if (loading) {
            return callbackQueue.push(callback)
        } else if (loaded) {
            return callback(villages)
        }

        callbackQueue.push(callback)
        loading = true
        let cells = []

        for (let gridX = 0; gridX < grid.length; gridX++) {
            for (let gridY = 0; gridY < grid[gridX].length; gridY++) {
                cells.push(grid[gridX][gridY])
            }
        }

        let requests = []

        cells.forEach(function (cell) {
            let promise = new Promise(function (resolve, reject) {
                socketService.emit(routeProvider.MAP_GET_MINIMAP_VILLAGES, cell, function (data) {
                    if (data.message) {
                        return reject(data.message)
                    }

                    if (data.villages.length) {
                        villages = villages.concat(data.villages)
                    }

                    resolve()
                })
            })

            requests.push(promise)
        })

        return Promise.all(requests).then(function () {
            loading = false
            loaded = true

            $rootScope.$broadcast(eventTypeProvider.MAP_DATA_LOADED)
            
            callbackQueue.forEach(function (queuedCallback) {
                queuedCallback(villages)
            })

            callbackQueue = []
        }).catch(function (error) {
            // eslint-disable-next-line no-console
            console.error(error.message)
        })
    }

    twoMapData.getVillages = function () {
        return villages
    }

    twoMapData.isLoaded = function () {
        return loaded
    }

    init()

    return twoMapData
})

define('two/ui', [
    'conf/conf',
    'conf/cdn',
    'two/ready'
], function (
    conf,
    cdnConf,
    ready
) {
    let interfaceOverflow = {}
    let templates = {}
    let initialized = false
    let $menu

    let $head = document.querySelector('head')
    let httpService = injector.get('httpService')
    let templateManagerService = injector.get('templateManagerService')
    let $templateCache = injector.get('$templateCache')

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        let path

        const success = function (data, status, headers, config) {
            $templateCache.put(path.substr(1), data)

            if (angular.isFunction(onSuccess)) {
                onSuccess(data, status, headers, config)
            }

            if (!$rootScope.$$phase) {
                $rootScope.$apply()
            }
        }

        const error = function (data, status, headers, config) {
            if (angular.isFunction(opt_onError)) {
                opt_onError(data, status, headers, config)
            }
        }

        if (0 !== templateName.indexOf('!')) {
            path = conf.TEMPLATE_PATH_EXT.join(templateName)
        } else {
            path = templateName.substr(1)
        }

        if ($templateCache.get(path.substr(1))) {
            success($templateCache.get(path.substr(1)), 304)
        } else {
            if (cdnConf.versionMap[path]) {
                httpService.get(path, success, error)
            } else {
                success(templates[path], 304)
            }
        }
    }

    interfaceOverflow.init = function () {
        if (initialized) {
            return false
        }

        let $wrapper = document.querySelector('#wrapper')
        let $container = document.createElement('div')
        let $mainButton = document.createElement('div')

        $container.className = 'two-menu-container'
        $wrapper.appendChild($container)

        $mainButton.className = 'two-main-button'
        $mainButton.style.display = 'none'
        $container.appendChild($mainButton)

        $menu = document.createElement('div')
        $menu.className = 'two-menu'
        $container.appendChild($menu)

        initialized = true
        interfaceOverflow.addStyle('.two-window a.select-handler{-webkit-box-shadow:none;box-shadow:none}.two-window .small-select a.select-handler{height:22px;line-height:22px}.two-window .small-select a.select-button{height:22px}.two-window input::placeholder{color:rgba(255,243,208,0.7)}.two-window .green{color:#07770b}.two-window .red{color:#770707}.two-window .blue{color:#074677}#toolbar-left{height:calc(100% - 273px) !important;top:165px !important}.two-menu-container{position:absolute;top:84px;left:0;width:90px;z-index:10}.two-menu-container:hover .two-main-button{background-position:0 -75px}.two-menu-container:hover .two-menu{opacity:1;visibility:visible;transition:opacity .1s ease-in-out}.two-main-button{left:0;width:75px;height:75px;background-image:url("data:image/png;base64,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");background-position:0 0;z-index:10}.two-menu{position:absolute;top:8px;left:85px;width:120px;display:flex;flex-flow:wrap;visibility:hidden;opacity:0;z-index:10}.two-menu .button{height:24px;padding:0 15px;line-height:22px;margin-bottom:8px}.two-menu .divisor{height:3px;margin-bottom:5px;background:linear-gradient(90deg, #4e2e1a, transparent);border-radius:10px;width:100%}#wrapper.window-open .two-menu-container{left:713px}#wrapper.window-open.window-fullsize .two-menu-container{display:none !important}input:not([type]){border:none;outline:none}a.link{font-weight:bold;color:#3f2615}a.link:hover{text-shadow:0 1px 0 #000;color:#fff}')

        ready(function () {
            $mainButton.style.display = 'block'
        }, ['map'])
    }

    interfaceOverflow.addTemplate = function (path, data) {
        templates[path] = data
    }

    interfaceOverflow.addStyle = function (styles) {
        let $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    interfaceOverflow.addMenuButton = function (label, order, _tooltip) {
        let $button = document.createElement('div')
        $button.className = 'btn-border btn-orange button'
        $button.innerHTML = label
        $button.style.order = order
        $menu.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu.appendChild($button)
    }

    interfaceOverflow.addDivisor = function (order) {
        let $div = document.createElement('div')
        $div.className = 'divisor'
        $div.style.order = order
        $menu.appendChild($div)
    }

    interfaceOverflow.isInitialized = function () {
        return initialized
    }

    return interfaceOverflow
})

require([
    'two/ui'
], function (interfaceOverflow) {
    if (interfaceOverflow.isInitialized()) {
        return false
    }

    interfaceOverflow.init()
})

require([
    'two/language',
    'two/ready',
    'Lockr'
], function (
    twoLanguage,
    ready,
    Lockr
) {
    const checkNewVersion = function () {
        const currentVersion = '2.0.0'
        const storedVersion = Lockr.get('twoverflow_version', '1.0.0')

        if (currentVersion.endsWith('dev')) {
            return false
        }

        const versionNumber = function (rawVersion) {
            if (/\d+\.\d+\.\d+/.test(rawVersion)) {
                return parseInt(rawVersion.split('.').reduce((a, b) => a + b), 10)
            }
        }

        if (versionNumber(currentVersion) > versionNumber(storedVersion)) {
            const changelogUrl = 'https://gitlab.com/relaxeaza/twoverflow/blob/master/CHANGELOG.md'
            const changelogMsg = $filter('i18n')('check_changes', $rootScope.loc.ale, 'common')
            const firefoxMsg = $filter('i18n')('firefox_shill', $rootScope.loc.ale, 'common')
            const updatedMsg = $filter('i18n')('new_version', $rootScope.loc.ale, 'common', currentVersion)

            $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_NEW, {
                message: `[b]${updatedMsg}[/b]\n[url=${changelogUrl}]${changelogMsg}[/url]\n\n${firefoxMsg}`
            })

            Lockr.set('twoverflow_version', currentVersion)
        }
    }

    ready(function () {
        twoLanguage.init()
        checkNewVersion()
    })
})

/**
 * https://github.com/tsironis/lockr
 */
define('Lockr', function(root, Lockr) {
    'use strict'

    Lockr.prefix = ''

    Lockr._getPrefixedKey = function(key, options) {
        options = options || {}

        if (options.noPrefix) {
            return key
        } else {
            return this.prefix + key
        }

    }

    Lockr.set = function(key, value, options) {
        const query_key = this._getPrefixedKey(key, options)

        try {
            localStorage.setItem(query_key, JSON.stringify({
                data: value
            }))
        } catch (e) {}
    }

    Lockr.get = function(key, missing, options) {
        const query_key = this._getPrefixedKey(key, options)
        let value

        try {
            value = JSON.parse(localStorage.getItem(query_key))
        } catch (e) {
            if (localStorage[query_key]) {
                value = {
                    data: localStorage.getItem(query_key)
                }
            } else {
                value = null
            }
        }
        
        if (value === null) {
            return missing
        } else if (typeof value === 'object' && typeof value.data !== 'undefined') {
            return value.data
        } else {
            return missing
        }
    }

    return Lockr
})

define('two/about', [], function () {
    let initialized = false

    let about = {}

    about.isInitialized = function () {
        return initialized
    }

    about.init = function () {
        initialized = true
    }

    return about
})

define('two/about/ui', [
    'two/ui'
], function (
    interfaceOverflow
) {
    let $scope
    
    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const init = function () {
        interfaceOverflow.addDivisor(99)
        const $button = interfaceOverflow.addMenuButton('O mnie', 100)

        $button.addEventListener('click', function () {
            buildWindow()
        })

        interfaceOverflow.addTemplate('twoverflow_about_window', `<div id=\"two-about\" class=\"win-content\"><header class=\"win-head\"><h3>tw2overflow v2.0.0</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"logo\"><img src=\"https://i.imgur.com/iNcVMvw.png\"></div><table class=\"tbl-border-light tbl-content tbl-medium-height\"><tr><th colspan=\"2\">{{ 'contact' | i18n:loc.ale:'about' }}<tr><td>{{ 'email' | i18n:loc.ale:'about' }}<td>twoverflow@outlook.com<tr><td colspan=\"2\" class=\"text-center\">If you are willing to pay $, I'm willing to make personal scripts for you.</table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><tr><th colspan=\"2\">{{ 'links' | i18n:loc.ale:'about' }}<tr><td>{{ 'source_code' | i18n:loc.ale:'about' }}<td><a href=\"https://gitlab.com/relaxeaza/twoverflow/\" target=\"_blank\">https://gitlab.com/relaxeaza/twoverflow/</a><tr><td>{{ 'issues_suggestions' | i18n:loc.ale:'about' }}<td><a href=\"https://gitlab.com/relaxeaza/twoverflow/issues\" target=\"_blank\">https://gitlab.com/relaxeaza/twoverflow/issues</a><tr><td>{{ 'translations' | i18n:loc.ale:'about' }}<td><a href=\"https://crowdin.com/project/twoverflow\" target=\"_blank\">https://crowdin.com/project/twoverflow</a></table></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"closeWindow()\">{{ 'cancel' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-about{padding:42px 0 0px 0;position:relative;height:100%}#two-about .box-paper a{font-weight:bold;color:#3f2615;text-decoration:none}#two-about .box-paper a:hover{text-shadow:0 1px 0 #000;color:#fff}#two-about .logo{text-align:center;margin-bottom:8px}#two-about table td{padding:0 10px}#two-about table td:first-child{text-align:right;width:20%}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.selectTab = selectTab

        windowManagerService.getModal('!twoverflow_about_window', $scope)
    }

    return init
})

require([
    'two/ready',
    'two/about',
    'two/about/ui'
], function (
    ready,
    about,
    aboutInterface
) {
    if (about.isInitialized()) {
        return false
    }

    ready(function () {
        about.init()
        aboutInterface()
    }, ['map'])
})

define('two/attackView', [
    'two/ready',
    'two/utils',
    'two/attackView/types/columns',
    'two/attackView/types/commands',
    'two/attackView/types/filters',
    'two/attackView/unitSpeedOrder',
    'conf/unitTypes',
    'conf/buildingTypes',
    'Lockr',
    'helper/math',
    'helper/mapconvert',
    'struct/MapData',
    'queues/EventQueue'
], function (
    ready,
    utils,
    COLUMN_TYPES,
    COMMAND_TYPES,
    FILTER_TYPES,
    UNIT_SPEED_ORDER,
    UNIT_TYPES,
    BUILDING_TYPES,
    Lockr,
    math,
    convert,
    mapData,
    eventQueue
) {
    let initialized = false
    let overviewService = injector.get('overviewService')
    let globalInfoModel
    let commands = []
    let commandQueue = false
    let filters = {}
    let filterParams = {}
    let sorting = {
        reverse: false,
        column: COLUMN_TYPES.TIME_COMPLETED
    }
    let COMMAND_QUEUE_DATE_TYPES
    const STORAGE_KEYS = {
        FILTERS: 'attack_view_filters'
    }
    const INCOMING_UNITS_FILTER = {}
    const COMMAND_TYPES_FILTER = {}

    const formatFilters = function () {
        const toArray = [FILTER_TYPES.COMMAND_TYPES]
        const currentVillageId = modelDataService.getSelectedVillage().getId()
        let arrays = {}

        // format filters for backend
        for (let i = 0; i < toArray.length; i++) {
            for (let j in filters[toArray[i]]) {
                if (!arrays[toArray[i]]) {
                    arrays[toArray[i]] = []
                }

                if (filters[toArray[i]][j]) {
                    switch (toArray[i]) {
                        case FILTER_TYPES.COMMAND_TYPES: {
                            if (j === COMMAND_TYPES.ATTACK) {
                                arrays[toArray[i]].push(COMMAND_TYPES.ATTACK)
                            } else if (j === COMMAND_TYPES.SUPPORT) {
                                arrays[toArray[i]].push(COMMAND_TYPES.SUPPORT)
                            } else if (j === COMMAND_TYPES.RELOCATE) {
                                arrays[toArray[i]].push(COMMAND_TYPES.RELOCATE)
                            }
                            break
                        }
                    }
                }
            }
        }

        filterParams = arrays
        filterParams.village = filters[FILTER_TYPES.VILLAGE] ? [currentVillageId] : []
    }

    /**
     * Command was sent.
     */
    const onCommandIncomming = function () {
        // we can never know if the command is currently visible (because of filters, sorting and stuff) -> reload
        attackView.loadCommands()
    }

    /**
     * Command was cancelled.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    const onCommandCancelled = function (event, data) {
        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, [data.id || data.command_id])
    }

    /**
     * Command ignored.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    const onCommandIgnored = function (event, data) {
        for (let i = 0; i < commands.length; i++) {
            if (commands[i].command_id === data.command_id) {
                commands.splice(i, 1)
            }
        }

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, [data.command_id])
    }

    /**
     * Village name changed.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    const onVillageNameChanged = function (event, data) {
        for (let i = 0; i < commands.length; i++) {
            if (commands[i].target_village_id === data.village_id) {
                commands[i].target_village_name = data.name
                commands[i].targetVillage.name = data.name
            } else if (commands[i].origin_village_id === data.village_id) {
                commands[i].origin_village_name = data.name
                commands[i].originVillage.name = data.name
            }
        }

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, [data])
    }

    const onVillageSwitched = function (e, newVillageId) {
        if (filterParams[FILTER_TYPES.VILLAGE].length) {
            filterParams[FILTER_TYPES.VILLAGE] = [newVillageId]

            attackView.loadCommands()
        }
    }

    /**
     * @param {CommandModel} command
     * @return {String} Slowest unit
     */
    const getSlowestUnit = function (command) {
        const origin = {
            x: command.origin_x,
            y: command.origin_y
        }
        const target = {
            x: command.target_x,
            y: command.target_y
        }
        const unitDurationDiff = UNIT_SPEED_ORDER.map(function (unit) {
            const travelTime = utils.getTravelTime(origin, target, {[unit]: 1}, command.command_type, {}, false)
            const durationDiff = Math.abs(travelTime - command.model.duration)

            return {
                unit: unit,
                diff: durationDiff
            }
        }).sort(function (a, b) {
            return a.diff - b.diff
        })

        return unitDurationDiff[0].unit
    }

    /**
     * Sort a set of villages by distance from a specified village.
     *
     * @param {Array[{x: Number, y: Number}]} villages List of village that will be sorted.
     * @param {VillageModel} origin
     * @return {Array} Sorted villages
     */
    const sortByDistance = function (villages, origin) {
        return villages.sort(function (villageA, villageB) {
            let distA = math.actualDistance(origin, villageA)
            let distB = math.actualDistance(origin, villageB)

            return distA - distB
        })
    }

    /**
     * Order:
     * - Barbarian villages.
     * - Own villages.
     * - Tribe villages.
     *
     * @param {VillageModel} origin
     * @param {Function} callback
     */
    const closestNonHostileVillage = function (origin, callback) {
        const size = 25
        let loadBlockIndex = 0

        if (mapData.hasTownDataInChunk(origin.x, origin.y)) {
            const sectors = mapData.loadTownData(origin.x, origin.y, size, size, size)
            const tribeId = modelDataService.getSelectedCharacter().getTribeId()
            const playerId = modelDataService.getSelectedCharacter().getId()
            let targets = []
            let closestTargets

            sectors.forEach(function (sector) {
                for (let x in sector.data) {
                    for (let y in sector.data[x]) {
                        targets.push(sector.data[x][y])
                    }
                }
            })


            const barbs = targets.filter(function (target) {
                return target.character_id === null && target.id > 0
            })

            const own = targets.filter(function (target) {
                return target.character_id === playerId && origin.id !== target.id
            })

            if (barbs.length) {
                closestTargets = sortByDistance(barbs, origin)
            } else if (own.length) {
                closestTargets = sortByDistance(own, origin)
            } else if (tribeId) {
                const tribe = targets.filter(function (target) {
                    return target.tribe_id === tribeId
                })

                if (tribe.length) {
                    closestTargets = sortByDistance(tribe, origin)
                } else {
                    return callback(false)
                }
            } else {
                return callback(false)
            }

            return callback(closestTargets[0])
        }
        
        const loads = convert.scaledGridCoordinates(origin.x, origin.y, size, size, size)

        mapData.loadTownDataAsync(origin.x, origin.y, size, size, function () {
            if (++loadBlockIndex === loads.length) {
                closestNonHostileVillage(origin, callback)
            }
        })
    }

    /**
     * @param {Object} data The data-object from the backend
     */
    const onOverviewIncomming = function (data) {
        commands = data.commands

        for (let i = 0; i < commands.length; i++) {
            overviewService.formatCommand(commands[i])
            commands[i].slowestUnit = getSlowestUnit(commands[i])
        }

        commands = commands.filter(function (command) {
            return filters[FILTER_TYPES.INCOMING_UNITS][command.slowestUnit]
        })

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, [commands])
    }

    let attackView = {}

    attackView.loadCommands = function () { 
        const incomingCommands = globalInfoModel.getCommandListModel().getIncomingCommands().length
        const count = incomingCommands > 25 ? incomingCommands : 25

        socketService.emit(routeProvider.OVERVIEW_GET_INCOMING, {
            'count': count,
            'offset': 0,
            'sorting': sorting.column,
            'reverse': sorting.reverse ? 1 : 0,
            'groups': [],
            'command_types': filterParams[FILTER_TYPES.COMMAND_TYPES],
            'villages': filterParams[FILTER_TYPES.VILLAGE]
        }, onOverviewIncomming)
    }

    attackView.getCommands = function () {
        return commands
    }

    attackView.getFilters = function () {
        return filters
    }

    attackView.getSortings = function () {
        return sorting
    }

    /**
     * Toggles the given filter.
     *
     * @param {string} type The category of the filter (see FILTER_TYPES)
     * @param {string} opt_filter The filter to be toggled.
     */
    attackView.toggleFilter = function (type, opt_filter) {
        if (!opt_filter) {
            filters[type] = !filters[type]
        } else {
            filters[type][opt_filter] = !filters[type][opt_filter]
        }

        // format filters for the backend
        formatFilters()
        Lockr.set(STORAGE_KEYS.FILTERS, filters)
        attackView.loadCommands()
    }

    attackView.toggleSorting = function (newColumn) {
        if (newColumn === sorting.column) {
            sorting.reverse = !sorting.reverse
        } else {
            sorting.column = newColumn
            sorting.reverse = false
        }

        attackView.loadCommands()
    }

    /**
     * Set an automatic command with all units from the village
     * and start the CommandQueue module if it's disabled.
     *
     * @param {Object} command Data of the command like origin, target.
     * @param {String} date Date that the command has to leave.
     */
    attackView.setCommander = function (command, date) {
        closestNonHostileVillage(command.targetVillage, function (closestVillage) {
            const origin = command.targetVillage
            const target = closestVillage
            const commandType = target.character_id ? COMMAND_TYPES.SUPPORT : COMMAND_TYPES.ATTACK
            let units = {}

            utils.each(UNIT_TYPES, function (unit) {
                units[unit] = '*'
            })

            commandQueue.addCommand(origin, target, date, COMMAND_QUEUE_DATE_TYPES.OUT, units, {}, commandType , BUILDING_TYPES.WALL)

            if (!commandQueue.isRunning()) {
                commandQueue.start()
            }
        })
    }

    attackView.commandQueueEnabled = function () {
        return !!commandQueue
    }

    attackView.isInitialized = function () {
        return initialized
    }

    attackView.init = function () {
        for (let i = 0; i < UNIT_SPEED_ORDER.length; i++) {
            INCOMING_UNITS_FILTER[UNIT_SPEED_ORDER[i]] = true
        }

        for (let i in COMMAND_TYPES) {
            COMMAND_TYPES_FILTER[COMMAND_TYPES[i]] = true
        }

        try {
            commandQueue = require('two/commandQueue')
            COMMAND_QUEUE_DATE_TYPES = require('two/commandQueue/types/dates')
        } catch (e) {}

        const defaultFilters = {
            [FILTER_TYPES.COMMAND_TYPES]: angular.copy(COMMAND_TYPES_FILTER),
            [FILTER_TYPES.INCOMING_UNITS]: angular.copy(INCOMING_UNITS_FILTER),
            [FILTER_TYPES.VILLAGE]: false
        }

        initialized = true
        globalInfoModel = modelDataService.getSelectedCharacter().getGlobalInfo()
        filters = Lockr.get(STORAGE_KEYS.FILTERS, defaultFilters, true)

        ready(function () {
            formatFilters()

            $rootScope.$on(eventTypeProvider.COMMAND_INCOMING, onCommandIncomming)
            $rootScope.$on(eventTypeProvider.COMMAND_CANCELLED, onCommandCancelled)
            $rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)
            $rootScope.$on(eventTypeProvider.VILLAGE_NAME_CHANGED, onVillageNameChanged)
            $rootScope.$on(eventTypeProvider.COMMAND_IGNORED, onCommandIgnored)

            attackView.loadCommands()
        }, ['initial_village'])
    }

    return attackView
})

define('two/attackView/events', [], function () {
    angular.extend(eventTypeProvider, {
        ATTACK_VIEW_FILTERS_CHANGED: 'attack_view_filters_changed',
        ATTACK_VIEW_SORTING_CHANGED: 'attack_view_sorting_changed',
        ATTACK_VIEW_COMMAND_CANCELLED: 'attack_view_command_cancelled',
        ATTACK_VIEW_COMMAND_IGNORED: 'attack_view_command_ignored',
        ATTACK_VIEW_VILLAGE_RENAMED: 'attack_view_village_renamed',
        ATTACK_VIEW_COMMANDS_LOADED: 'attack_view_commands_loaded'
    })
})

define('two/attackView/ui', [
    'two/ui',
    'two/attackView',
    'two/EventScope',
    'two/utils',
    'two/attackView/types/columns',
    'two/attackView/types/commands',
    'two/attackView/types/filters',
    'two/attackView/unitSpeedOrder',
    'conf/unitTypes',
    'queues/EventQueue',
    'helper/time',
    'battlecat'
], function (
    interfaceOverflow,
    attackView,
    EventScope,
    utils,
    COLUMN_TYPES,
    COMMAND_TYPES,
    FILTER_TYPES,
    UNIT_SPEED_ORDER,
    UNIT_TYPES,
    eventQueue,
    timeHelper,
    $
) {
    let $scope
    let $button

    const nowSeconds = function () {
        return Date.now() / 1000
    }

    const copyTimeModal = function (time) {
        let modalScope = $rootScope.$new()
        modalScope.text = $filter('readableDateFilter')(time * 1000, $rootScope.loc.ale, $rootScope.GAME_TIMEZONE, $rootScope.GAME_TIME_OFFSET, 'H:mm:ss:sss dd/MM/yyyy')
        modalScope.title = $filter('i18n')('copy', $rootScope.loc.ale, 'attack_view')
        windowManagerService.getModal('!twoverflow_attack_view_show_text_modal', modalScope)
    }

    const removeTroops = function (command) {
        const formatedDate = $filter('readableDateFilter')((command.time_completed - 10) * 1000, $rootScope.loc.ale, $rootScope.GAME_TIMEZONE, $rootScope.GAME_TIME_OFFSET, 'H:mm:ss:sss dd/MM/yyyy')
        attackView.setCommander(command, formatedDate)
    }

    const switchWindowSize = function () {
        let $window = $('#two-attack-view').parent()
        let $wrapper = $('#wrapper')

        $window.toggleClass('fullsize')
        $wrapper.toggleClass('window-fullsize')
    }

    const updateVisibileCommands = function () {
        const offset = $scope.pagination.offset
        const limit = $scope.pagination.limit

        $scope.visibleCommands = $scope.commands.slice(offset, offset + limit)
        $scope.pagination.count = $scope.commands.length
    }

    const checkCommands = function () {
        const now = Date.now()

        for (let i = 0; i < $scope.commands.length; i++) {
            if ($scope.commands[i].model.percent(now) === 100) {
                $scope.commands.splice(i, 1)
            }
        }

        updateVisibileCommands()
    }

    // scope functions

    const toggleFilter = function (type, _filter) {
        attackView.toggleFilter(type, _filter)
        $scope.filters = attackView.getFilters()
    }

    const toggleSorting = function (column) {
        attackView.toggleSorting(column)
        $scope.sorting = attackView.getSortings()
    }

    const eventHandlers = {
        updateCommands: function () {
            $scope.commands = attackView.getCommands()
        },
        onVillageSwitched: function () {
            $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        }
    }

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Strażnik', 40)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_attack_view_main', `<div id=\"two-attack-view\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Strażnik</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-orange icon-26x26-double-arrow\" ng-click=\"switchWindowSize()\"></a><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap rich-text\"><div class=\"filters\"><table class=\"tbl-border-light\"><tr><th>{{ 'village' | i18n:loc.ale:'common' }}<tr><td><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.VILLAGE]}\" ng-click=\"toggleFilter(FILTER_TYPES.VILLAGE)\" tooltip=\"\" tooltip-content=\"{{ 'current_only_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-village-info icon-bg-black\"></span></div></table><table class=\"tbl-border-light\"><tr><th>{{ 'filter_types' | i18n:loc.ale:'attack_view' }}<tr><td><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.COMMAND_TYPES][COMMAND_TYPES.ATTACK]}\" ng-click=\"toggleFilter(FILTER_TYPES.COMMAND_TYPES, COMMAND_TYPES.ATTACK)\" tooltip=\"\" tooltip-content=\"{{ 'filter_show_attacks_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-attack icon-bg-black\"></span></div><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.COMMAND_TYPES][COMMAND_TYPES.SUPPORT]}\" ng-click=\"toggleFilter(FILTER_TYPES.COMMAND_TYPES, COMMAND_TYPES.SUPPORT)\" tooltip=\"\" tooltip-content=\"{{ 'filter_show_supports_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-support icon-bg-black\"></span></div><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.COMMAND_TYPES][COMMAND_TYPES.RELOCATE]}\" ng-click=\"toggleFilter(FILTER_TYPES.COMMAND_TYPES, COMMAND_TYPES.RELOCATE)\" tooltip=\"\" tooltip-content=\"{{ 'filter_show_relocations_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-relocate icon-bg-black\"></span></div></table><table class=\"tbl-border-light\"><tr><th>{{ 'filter_incoming_units' | i18n:loc.ale:'attack_view' }}<tr><td><div ng-repeat=\"unit in ::UNIT_SPEED_ORDER\" class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.INCOMING_UNITS][unit]}\" ng-click=\"toggleFilter(FILTER_TYPES.INCOMING_UNITS, unit)\" tooltip=\"\" tooltip-content=\"{{ unit | i18n:loc.ale:'unit_names' }}\"><span class=\"icon-34x34-unit-{{ unit }} icon-bg-black\"></span></div></table></div><div class=\"page-wrap\" pagination=\"pagination\"></div><p class=\"text-center\" ng-show=\"!visibleCommands.length\">{{ 'no_incoming' | i18n:loc.ale:'attack_view' }}<table class=\"tbl-border-light commands-table\" ng-show=\"visibleCommands.length\"><col width=\"8%\"><col width=\"14%\"><col><col><col width=\"4%\"><col width=\"15%\"><col width=\"11%\"><thead class=\"sorting\"><tr><th ng-click=\"toggleSorting(COLUMN_TYPES.COMMAND_TYPE)\" tooltip=\"\" tooltip-content=\"{{ 'command_type_tooltip' | i18n:loc.ale:'attack_view' }}\">{{ 'command_type' | i18n:loc.ale:'attack_view' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.COMMAND_TYPE\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th ng-click=\"toggleSorting(COLUMN_TYPES.ORIGIN_CHARACTER)\">{{ 'player' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.ORIGIN_CHARACTER\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th ng-click=\"toggleSorting(COLUMN_TYPES.ORIGIN_VILLAGE)\">{{ 'origin' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.ORIGIN_VILLAGE\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th ng-click=\"toggleSorting(COLUMN_TYPES.TARGET_VILLAGE)\">{{ 'target' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.TARGET_VILLAGE\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th tooltip=\"\" tooltip-content=\"{{ 'slowest_unit_tooltip' | i18n:loc.ale:'attack_view' }}\">{{ 'slowest_unit' | i18n:loc.ale:'attack_view' }}<th ng-click=\"toggleSorting(COLUMN_TYPES.TIME_COMPLETED)\">{{ 'arrive' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.TIME_COMPLETED\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th>{{ 'actions' | i18n:loc.ale:'attack_view' }}<tbody><tr ng-repeat=\"command in visibleCommands\" class=\"{{ command.command_type }}\" ng-class=\"{'snob': command.slowestUnit === UNIT_TYPES.SNOB}\"><td><span class=\"icon-20x20-{{ command.command_type }}\"></span><td ng-click=\"openCharacterProfile(command.originCharacter.id)\" class=\"character\"><span class=\"name\">{{ command.originCharacter.name }}</span><td ng-class=\"{'selected': command.originVillage.id === selectedVillageId}\" class=\"village\"><span class=\"name\" ng-click=\"openVillageInfo(command.originVillage.id)\">{{ command.originVillage.name }}</span> <span class=\"coords\" ng-click=\"jumpToVillage(command.originVillage.x, command.originVillage.y)\">({{ command.originVillage.x }}|{{ command.originVillage.y }})</span><td ng-class=\"{'selected': command.targetVillage.id === selectedVillageId}\" class=\"village\"><span class=\"name\" ng-click=\"openVillageInfo(command.targetVillage.id)\">{{ command.targetVillage.name }}</span> <span class=\"coords\" ng-click=\"jumpToVillage(command.targetVillage.x, command.targetVillage.y)\">({{ command.targetVillage.x }}|{{ command.targetVillage.y }})</span><td><span class=\"icon-20x20-unit-{{ command.slowestUnit }}\"></span><td><div class=\"progress-wrapper\" tooltip=\"\" tooltip-content=\"{{ command.model.arrivalTime() | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}\"><div class=\"progress-bar\" ng-style=\"{width: command.model.percent() + '%'}\"></div><div class=\"progress-text\"><span>{{ command.model.countdown() }}</span></div></div><td><a ng-click=\"copyTimeModal(command.time_completed)\" class=\"btn btn-orange size-20x20 icon-20x20-arrivetime\" tooltip=\"\" tooltip-content=\"{{ 'commands_copy_arrival_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-click=\"copyTimeModal(command.time_completed + (command.time_completed - command.time_start))\" class=\"btn btn-red size-20x20 icon-20x20-backtime\" tooltip=\"\" tooltip-content=\"{{ 'commands_copy_backtime_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"removeTroops(command)\" class=\"btn btn-orange size-20x20 icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'commands_set_remove_tooltip' | i18n:loc.ale:'attack_view' }}\"></a></table><div class=\"page-wrap\" pagination=\"pagination\"></div></div></div></div></div>`)
        interfaceOverflow.addTemplate('twoverflow_attack_view_show_text_modal', `<div id=\"show-text-modal\" class=\"win-content\"><header class=\"win-head\"><h3>{{ title }}</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap\"><form ng-submit=\"closeWindow()\"><input class=\"input-border text-center\" ng-model=\"text\"></form></div></div></div><footer class=\"win-foot sprite-fill\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-green btn-border\" ng-click=\"closeWindow()\">OK</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-attack-view table.commands-table{table-layout:fixed;font-size:13px;margin-bottom:10px}#two-attack-view table.commands-table th{text-align:center;padding:0px}#two-attack-view table.commands-table td{padding:1px 0;min-height:initial;border:none;text-align:center}#two-attack-view table.commands-table tr.attack.snob td{background:#bb8658}#two-attack-view table.commands-table tr.support td,#two-attack-view table.commands-table tr.relocate td{background:#9c9368}#two-attack-view table.commands-table .empty td{height:32px}#two-attack-view table.commands-table .sorting .arrow{margin-top:-4px}#two-attack-view .village .coords{font-size:11px;color:#71471a}#two-attack-view .village .coords:hover{color:#ffde00;text-shadow:0 1px 0 #000}#two-attack-view .village .name:hover{color:#fff;text-shadow:0 1px 0 #000}#two-attack-view .village.selected .name{font-weight:bold}#two-attack-view .character .name:hover{color:#fff;text-shadow:1px 1px 0 #000}#two-attack-view .progress-wrapper{height:20px;margin-bottom:0}#two-attack-view .progress-wrapper .progress-text{position:absolute;width:100%;height:100%;text-align:center;z-index:10;padding:0 5px;line-height:20px;color:#f0ffc9;overflow:hidden}#two-attack-view .filters{height:95px;margin-bottom:10px}#two-attack-view .filters table{width:auto;float:left;margin:5px}#two-attack-view .filters .icon{width:38px;float:left;margin:0 6px}#two-attack-view .filters .icon.active:before{box-shadow:0 0 0 1px #000,-1px -1px 0 2px #ac9c44,0 0 0 3px #ac9c44,0 0 0 4px #000;border-radius:1px;content:"";position:absolute;width:38px;height:38px;left:-1px;top:-1px}#two-attack-view .filters td{padding:6px}#two-attack-view .icon-20x20-backtime{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAEMklEQVQ4y42US2xUdRTGf3funZn/PHqnnVdpKZZ2RCWBVESgoZogSAKKEEAlGhVNLMGg0QiJKxYudIdoTEyDj8SFGo2seDUGhEQqRHk/UimDpdAptHMr8+jM3Dv35QJbi9KEszzJ+eU753z5JKYuOQGBUpAa2SLiuPgBPBKGrZAPlSlmoQLYk4ekqUCmEHHL0pslRb7fsNwWF8L/DIz5Fanftey0oogBr65rk8HS3WC6jyY8ckfZdNtfWdX++tzGIDMabAJmArte4my/l/c//vaLoFc6jmP3iCqD41B5Mi0BId1Hk+V6ljfEQlvWL2xZoY/lKOTLGCY01tZhVLMkRJEtqzoeyUvSnN70SNZRXC1iUylDVZmszhQiDmbH9Lrgpta4mKPlCjy95D6Wrn8GAKFEEfEmdG2Qowd+4I0XFrUC7+w7eL5sCu8hdL3imaQuYFl6c9l021vjYk7Y72Xjq4/z1IaNCCVKMRckq+moiQDJ2bN48uV3GbnSx9b1ra1l0223LL05AYF/Vw4S80jyonnN6paq5YTe3LyU2rpaYrFpJGfPItlcTzI1H8R8cC38NTFiaojhSzeJJ8KNJ/4YOmP43GsTCmWLiGG5LTUBb2LuzGm3e3Ij3321m5Hey6A0AVAcPjmhQcSbuDyU5sF6e5phuS2yRWQC6Lj4x62h1vjJ3BwjlUoiYn52ffolmUtnuXj4ADu2b7/DFoN9RVQ1gAthx8U/+Sk4LiGAQtFAHzXIajpr16yiu/tX98euzyWAzrc6Abj8+1G0TIZ8uYx/xJpgjANlWfEKqjaZbIlixQQgdDHDyuULWLFisZTVdBJxQTIVA2uQ+qZ6KoU0nhqV09f+QoIxj4ThAWRVJWLZToNXUaarYR8Hdm+iZBic7N5LbmgI0xclERcAFLIVAHRtkFOHjwBwNHNryK9I/bZCXlFVIk6ZuSbukidmR1Z+/cliAHzRBjKjBTq37bz9gEAAgA+2vQjAjb4j9F6pUCga/Hzm5v6A5KRDFkXF1UnWRcRj256d/vam9zrJXT0GwGc7V+ONRwAwtTwAa9bs4ND+PTy8MMW5az7+vJ7lXKZ4IeiVjsuIgaylVxTHxf/S84+u3bh5Mbmrx/D6Y1hjGtaYBjduH9g0RonNSmH4o/T1j9JzeoBixSRbsi9ktNIuRXJ6vFVbA2ypVoiZNuay+qj62r6u1R0ee4i65Iw7rDEOnLegC4CSqwxf18b23C0cFMenF5wKJzLZfLDtuW/4pWt1Ry6XY8/ug8jRB6gN3GI0k6VtXcq9csvqtm2rTyjS+YDkpGXEgLdq/z++EhA2hYjbmMtMx7P8+4/Wbdj64U89/cP5Xlli2HGcUsAnjziulMGxbrheRu4lYH21QjSarvXQoraZbQC/nUoflzwMyx6hVz26MRVkysROQNhQ8XmqQr1XwH/rb2Du69Eebp25AAAAAElFTkSuQmCC")}#two-attack-view .icon-20x20-arrivetime{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAEW0lEQVQ4y4WUWWxUZRiGn7PMnNPOVtvODHQBSlulAUFBoQiEaBHBhCsSFaIhIe6JSyAkRkO8NpErY2KoYuINISkkRFAjEUyAUCQsBSu1BVpKZ2DmTNuZzsyZMz3L70Vbgkjqe/Ul//89//K9eSX+KyUKFcVKQopDxBNoALJE2VXJBUzyBpQA9xG9SA+DbF2vdRxrvqQqLWVHNAkITm8saKo0KBz3hqrqt32WlXkUWHoQZvlpQFbWmLZo//zj7W8ua7JRUoKSz+DOXYVrSZMfjnV/W+mTuvHcs/okIw9DFYAoBCw/DY6QX9yycemer9/p6KiQE7ilIj4vwNXBFIO3M1iFLKta4suNvLUwZzpZTxWZiEvJhMkHgYpf1+cKSazfsnHpnve2rVqYTg2xdvMrPL76JWKNNSxesYB1LyyDiQQ9fWkCmhxzkRuLZTcpVC1lOU4eEDNPDUzitJVc6eUDn6zuSAwl2PDGLqrnx9ECPob6kkxaPiLBEK1LniIaFVz/c4SAJsf6U2ZaEfZwxMOYuaVCJTWypKz68LXV7y6sigWf7thMdfMKkMOgryA2r5pYYwWBaA3FzBhFM8uiRXFOnumn/jGt0SjYl8t+MWzbFABkxSFSdkTTE3F3zkDyBnptw/2J5VMXpwq1gfT1AQ4eOIyi1AHw5II5hCp80bIjmhSHyEyP7Ak0AcFwuIKR/vy/PLVv7156T/1M4u8e9n/1HXqNRnNzjMS9AuGQBlMfF5zxKoA6U2hph5xp0nv+ErX1KVqfXctbH+yk65tOAOa1tolNm56TjIyFNVpmIl8GwBMEHnSzKkuUJUHh8vAYcihMIFQi3hAHZ4T65hq27dyKkbGI1uqS7a/mXO8F+gZGuDZ0j4nClFsU1adj2wrgyq5KTlOlwTOJ8STApVO/Y2VGAJgwSgBEa3VsfzXZZJKLvxyjWC7z8+G3CQf9+FS13nG9ueEwEUBRqmywEfrAvWLF4rqq5fmiwCvcIjuqYCTu8v5nnXQd7+bgoZ/48dduXF8F4ZpaNj0/j60bgly+YLTeNMyUYosxPUhONaBUpeq3K7G7T/Ym2pfWh5ZU1MzBX/0XV/64iVYe4+jR3QD4aqeGaWdylPNjABw9upv9X3R+9GVXwsjmrZQCiJDjOI4scjnTyZZc0ZhKJmM9PcNYlsu4CLJjez3jt65ij45jpZPYhVG8SRNFrcQc7eeZ9evIl9xI96Xh4yqAAaXoJCOW3zuRGjfNwbRob6wNbkkYxTizaDx9B0+pY93rnWdTYxPf+xQ9p0yvCRPciEtJqFpKEfZwyXaupArOYLbM+JK2lS3HDhyRbgwanO6eoPvEaWLxOixLY+WOrrP5onUI4Z2TdMeQZgtYySaGrM6VJVFfmnRjsiwHXEG8KR5p2/fpxjWv7jpyyCd7JxR8v03nY0Fidt2H+z1dcz1LFx7xlctb2gHO9wz1+CS1L2tZSabD4f+Asx7g+a0JbYJJg6lgAPgHUh4QWRIJr4EAAAAASUVORK5CYII=")}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.commandQueueEnabled = attackView.commandQueueEnabled()
        $scope.commands = attackView.getCommands()
        $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        $scope.filters = attackView.getFilters()
        $scope.sorting = attackView.getSortings()
        $scope.UNIT_TYPES = UNIT_TYPES
        $scope.FILTER_TYPES = FILTER_TYPES
        $scope.COMMAND_TYPES = COMMAND_TYPES
        $scope.UNIT_SPEED_ORDER = UNIT_SPEED_ORDER
        $scope.COLUMN_TYPES = COLUMN_TYPES
        $scope.pagination = {
            count: $scope.commands.length,
            offset: 0,
            loader: updateVisibileCommands,
            limit: storageService.getPaginationLimit()
        }

        // functions
        $scope.openCharacterProfile = windowDisplayService.openCharacterProfile
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.now = nowSeconds
        $scope.copyTimeModal = copyTimeModal
        $scope.removeTroops = removeTroops
        $scope.switchWindowSize = switchWindowSize
        $scope.toggleFilter = toggleFilter
        $scope.toggleSorting = toggleSorting

        updateVisibileCommands()

        let eventScope = new EventScope('twoverflow_queue_window', function onWindowClose() {
            timeHelper.timer.remove(checkCommands)
        })
        eventScope.register(eventTypeProvider.MAP_SELECTED_VILLAGE, eventHandlers.onVillageSwitched, true)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, eventHandlers.updateCommands)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_attack_view_main', $scope)

        timeHelper.timer.add(checkCommands)
    }

    return init
})

define('two/attackView/types/columns', [], function () {
    return {
        'ORIGIN_VILLAGE': 'origin_village_name',
        'COMMAND_TYPE': 'command_type',
        'TARGET_VILLAGE': 'target_village_name',
        'TIME_COMPLETED': 'time_completed',
        'ORIGIN_CHARACTER': 'origin_character_name'
    }
})

define('two/attackView/types/commands', [], function () {
    return {
        'ATTACK': 'attack',
        'SUPPORT': 'support',
        'RELOCATE': 'relocate'
    }
})

define('two/attackView/types/filters', [], function () {
    return {
        'COMMAND_TYPES' : 'command_types',
        'VILLAGE' : 'village',
        'INCOMING_UNITS' : 'incoming_units'
    }
})

define('two/attackView/unitSpeedOrder', [
    'conf/unitTypes'
], function (
    UNIT_TYPES
) {
    return [
        UNIT_TYPES.LIGHT_CAVALRY,
        UNIT_TYPES.HEAVY_CAVALRY,
        UNIT_TYPES.AXE,
        UNIT_TYPES.SWORD,
        UNIT_TYPES.RAM,
        UNIT_TYPES.SNOB,
        UNIT_TYPES.TREBUCHET
    ]
})

require([
    'two/ready',
    'two/attackView',
    'two/attackView/ui',
    'two/attackView/events'
], function (
    ready,
    attackView,
    attackViewInterface
) {
    if (attackView.isInitialized()) {
        return false
    }

    ready(function () {
        attackView.init()
        attackViewInterface()
    })
})

define('two/autoCollector', [
    'queues/EventQueue'
], function (
    eventQueue
) {
    let initialized = false
    let running = false

    /**
     * Permite que o evento RESOURCE_DEPOSIT_JOB_COLLECTIBLE seja executado
     * apenas uma vez.
     */
    let recall = true

    /**
     * Next automatic reroll setTimeout ID.
     */
    let nextUpdateId = 0

    /**
     * Inicia um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    const startJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_START_JOB, {
            job_id: job.id
        })
    }

    /**
     * Coleta um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    const finalizeJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_COLLECT, {
            job_id: job.id,
            village_id: modelDataService.getSelectedVillage().getId()
        })
    }

    /**
     * Força a atualização das informações do depósito.
     */
    const updateDepositInfo = function () {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_GET_INFO, {})
    }

    /**
     * Faz a analise dos trabalhos sempre que um evento relacionado ao depósito
     * é disparado.
     */
    const analyse = function () {
        if (!running) {
            return false
        }

        let data = modelDataService.getSelectedCharacter().getResourceDeposit()

        if (!data) {
            return false
        }

        if (data.getCurrentJob()) {
            return false
        }

        let collectible = data.getCollectibleJobs()

        if (collectible) {
            return finalizeJob(collectible.shift())
        }

        let ready = data.getReadyJobs()

        if (ready) {
            return startJob(getFastestJob(ready))
        }
    }

    /**
     * Obtem o trabalho de menor duração.
     *
     * @param {Array} jobs - Lista de trabalhos prontos para serem iniciados.
     */
    const getFastestJob = function (jobs) {
        const sorted = jobs.sort(function (a, b) {
            return a.duration - b.duration
        })

        return sorted[0]
    }

    /**
     * Atualiza o timeout para que seja forçado a atualização das informações
     * do depósito quando for resetado.
     * Motivo: só é chamado automaticamente quando um milestone é resetado,
     * e não o diário.
     * 
     * @param {Object} data - Os dados recebidos de RESOURCE_DEPOSIT_INFO
     */
    const rerollUpdater = function (data) {
        const timeLeft = data.time_next_reset * 1000 - Date.now() + 1000

        clearTimeout(nextUpdateId)
        nextUpdateId = setTimeout(updateDepositInfo, timeLeft)
    }

    /**
     * Métodos públicos do AutoCollector.
     *
     * @type {Object}
     */
    let autoCollector = {}

    /**
     * Inicializa o AutoDepois, configura os eventos.
     */
    autoCollector.init = function () {
        initialized = true

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTIBLE, function () {
            if (!recall || !running) {
                return false
            }

            recall = false

            setTimeout(function () {
                recall = true
                analyse()
            }, 1500)
        })

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOBS_REROLLED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_INFO, function (event, data) {
            analyse()
            rerollUpdater(data)
        })
    }

    /**
     * Inicia a analise dos trabalhos.
     */
    autoCollector.start = function () {
        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STARTED)
        running = true
        analyse()
    }

    /**
     * Para a analise dos trabalhos.
     */
    autoCollector.stop = function () {
        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STOPPED)
        running = false
    }

    /**
     * Retorna se o modulo está em funcionamento.
     */
    autoCollector.isRunning = function () {
        return running
    }

    /**
     * Retorna se o modulo está inicializado.
     */
    autoCollector.isInitialized = function () {
        return initialized
    }

    return autoCollector
})

define('two/autoCollector/events', [], function () {
    angular.extend(eventTypeProvider, {
        AUTO_COLLECTOR_STARTED: 'auto_collector_started',
        AUTO_COLLECTOR_STOPPED: 'auto_collector_stopped',
        AUTO_COLLECTOR_SECONDVILLAGE_STARTED: 'auto_collector_secondvillage_started',
        AUTO_COLLECTOR_SECONDVILLAGE_STOPPED: 'auto_collector_secondvillage_stopped'
    })
})

define('two/autoCollector/ui', [
    'two/ui',
    'two/autoCollector',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoCollector,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Kolekcjoner', 50, $filter('i18n')('description', $rootScope.loc.ale, 'auto_collector'))
        
        $button.addEventListener('click', function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_collector'))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_collector'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (autoCollector.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STARTED)
        }

        return opener
    }

    return init
})

define('two/autoCollector/secondVillage', [
    'two/autoCollector',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'models/SecondVillageModel'
], function (
    autoCollector,
    utils,
    eventQueue,
    $timeHelper,
    SecondVillageModel
) {
    let initialized = false
    let running = false
    let allFinished = false
    let secondVillageService = injector.get('secondVillageService')

    const getRunningJob = function (jobs) {
        const now = Date.now()

        for (let id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if (now < $timeHelper.server2ClientTime(jobs[id].time_completed)) {
                    return jobs[id]
                }
            }
        }

        return false
    }

    const getCollectibleJob = function (jobs) {
        const now = Date.now()

        for (let id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if ((now >= $timeHelper.server2ClientTime(jobs[id].time_completed)) && !jobs[id].collected) {
                    return id
                }
            }
        }

        return false
    }

    const finalizeJob = function (jobId) {
        socketService.emit(routeProvider.SECOND_VILLAGE_COLLECT_JOB_REWARD, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        })
    }

    const startJob = function (job, callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_START_JOB, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: job.id
        }, callback)
    }

    const getFirstJob = function (jobs) {
        let jobId = false

        utils.each(jobs, function (id) {
            jobId = id
            return false
        })

        return jobId
    }

    const updateSecondVillageInfo = function (callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            if (secondVillageService.hasFinishedLastJob(data.jobs)) {
                allFinished = true
                socketService.emit(routeProvider.SECOND_VILLAGE_FINISH_VILLAGE)
                secondVillageCollector.stop()
            } else{
                let model = new SecondVillageModel(data)
                modelDataService.getSelectedCharacter().setSecondVillage(model)
                callback()
            }
        })
    }

    const updateAndAnalyse = function () {
        updateSecondVillageInfo(analyse)
    }

    const analyse = function () {
        let secondVillage = modelDataService.getSelectedCharacter().getSecondVillage()

        if (!running || !secondVillage || !secondVillage.isAvailable()) {
            return false
        }

        const current = getRunningJob(secondVillage.data.jobs)

        if (current) {
            const completed = $timeHelper.server2ClientTime(current.time_completed)
            const nextRun = completed - Date.now() + 1000

            setTimeout(updateAndAnalyse, nextRun)

            return false
        }

        const collectible = getCollectibleJob(secondVillage.data.jobs)
        
        if (collectible) {
            return finalizeJob(collectible)
        }

        const currentDayJobs = secondVillageService.getCurrentDayJobs(secondVillage.data.jobs, secondVillage.data.day)
        const collectedJobs = secondVillageService.getCollectedJobs(secondVillage.data.jobs)
        const resources = modelDataService.getSelectedVillage().getResources().getResources()
        const availableJobs = secondVillageService.getAvailableJobs(currentDayJobs, collectedJobs, resources, [])

        if (availableJobs) {
            const firstJob = getFirstJob(availableJobs)

            startJob(firstJob, function () {
                const job = availableJobs[firstJob]

                if (job) {
                    setTimeout(updateAndAnalyse, (job.duration * 1000) + 1000)
                } else {
                    setTimeout(updateAndAnalyse, 60 * 1000)
                }

            })
        }
    }

    let secondVillageCollector = {}

    secondVillageCollector.start = function () {
        if (!initialized || allFinished) {
            return false
        }

        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_SECONDVILLAGE_STARTED)
        running = true
        updateAndAnalyse()
    }

    secondVillageCollector.stop = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_SECONDVILLAGE_STOPPED)
        running = false
    }

    secondVillageCollector.isRunning = function () {
        return running
    }

    secondVillageCollector.isInitialized = function () {
        return initialized
    }

    secondVillageCollector.init = function () {
        if (!secondVillageService.isFeatureActive()) {
            return false
        }

        initialized = true

        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            if (secondVillageService.hasFinishedLastJob(data.jobs)) {
                allFinished = true
                socketService.emit(routeProvider.SECOND_VILLAGE_FINISH_VILLAGE)
            } else {
                $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
                $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_JOB_COLLECTED, updateAndAnalyse)
            }
        })
    }

    autoCollector.secondVillage = secondVillageCollector
})

require([
    'two/ready',
    'two/autoCollector',
    'two/autoCollector/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/events'
], function (
    ready,
    autoCollector,
    autoCollectorInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'auto_collector_active'
    }

    if (autoCollector.isInitialized()) {
        return false
    }

    ready(function () {
        autoCollector.init()
        autoCollector.secondVillage.init()
        autoCollectorInterface()
        
        ready(function () {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                autoCollector.start()
                autoCollector.secondVillage.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})

define('two/autoHealer', [
    'queues/EventQueue'
], function (
    eventQueue
) {
    let initialized = false
    let running = false
	
    let interval = 3000
    let interval1 = 1000

    const healUnits = function () {
        if (!running) {
            return false
        }
		
        let player = modelDataService.getSelectedCharacter()
        let villages = player.getVillageList()
        villages.forEach(function(village, index) {
            let hospital = village.hospital
            let patients = hospital.patients
            let healed = patients.healed
            if (healed.length == 0) {
                console.log('W wiosce ' + village.getName() + ' brak jednostek do wyleczenia.')
            } else {
                setTimeout(function() {
                    healed.forEach(function(heal, index) {
                        setTimeout(function() {
                            socketService.emit(routeProvider.HOSPITAL_RELEASE_PATIENT, {
                                village_id: village.getId(),
                                patient_id: heal.id
                            })
                        }, index * interval1)
                        console.log('W wiosce: ' + village.getName() + ' wyleczono: ' + heal.id)
                    })
                }, index * interval)
            }
        })
        console.log('Medyk zatrzymany')
        autoHealer.stop()
    }
    let autoHealer = {}
    autoHealer.init = function() {
        initialized = true
    }
    autoHealer.start = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_HEALER_STARTED)
        running = true
        healUnits()
    }
    autoHealer.stop = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_HEALER_STOPPED)
        running = false
    }
    autoHealer.isRunning = function() {
        return running
    }
    autoHealer.isInitialized = function() {
        return initialized
    }
    return autoHealer
})
define('two/autoHealer/events', [], function () {
    angular.extend(eventTypeProvider, {
        AUTO_HEALER_STARTED: 'auto_healer_started',
        AUTO_HEALER_STOPPED: 'auto_healer_stopped'
    })
})

define('two/autoHealer/ui', [
    'two/ui',
    'two/autoHealer',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoHealer,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Medyk', 50, $filter('i18n')('description', $rootScope.loc.ale, 'auto_healer'))

        $button.addEventListener('click', function () {
            if (autoHealer.isRunning()) {
                autoHealer.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_healer'))
            } else {
                autoHealer.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_healer'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_HEALER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_HEALER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (autoHealer.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_HEALER_STARTED)
        }

        return opener
    }

    return init
})

require([
    'two/ready',
    'two/autoHealer',
    'two/autoHealer/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoHealer/events'
], function(
    ready,
    autoHealer,
    autoHealerInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'auto_healer_active'
    }
	
    if (autoHealer.isInitialized()) {
        return false
    }
    ready(function() {
        autoHealer.init()
        autoHealerInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                autoHealer.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_HEALER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_HEALER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/builderQueue', [
    'two/ready',
    'two/utils',
    'two/Settings',
    'two/builderQueue/settings',
    'two/builderQueue/settings/map',
    'two/builderQueue/settings/updates',
    'two/builderQueue/sequenceStatus',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes',
    'queues/EventQueue',
    'Lockr',
    'helper/time'
], function (
    ready,
    utils,
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    SEQUENCE_STATUS,
    UPGRADEABILITY_STATES,
    BUILDING_TYPES,
    LOCATION_TYPES,
    eventQueue,
    Lockr,
    timeHelper
) {
    let buildingService = injector.get('buildingService')
    let premiumActionService = injector.get('premiumActionService')
    let buildingQueueService = injector.get('buildingQueueService')
    let initialized = false
    let running = false
    let intervalCheckId
    let intervalInstantCheckId
    let buildingSequenceLimit
    const ANALYSES_PER_MINUTE = 1
    const ANALYSES_PER_MINUTE_INSTANT_FINISH = 10
    const VILLAGE_BUILDINGS = {}
    const LOGS_LIMIT = 500
    let groupList
    let $player
    let logs
    let sequencesAvail = true
    let settings
    let builderSettings
    const STORAGE_KEYS = {
        LOGS: 'builder_queue_log',
        SETTINGS: 'builder_queue_settings'
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    const analyseVillages = function () {
        const villageIds = getVillageIds()

        if (!sequencesAvail) {
            builderQueue.stop()
            return false
        }

        villageIds.forEach(function (villageId) {
            const village = $player.getVillage(villageId)
            const readyState = village.checkReadyState()
            const queue = village.buildingQueue
            const jobs = queue.getAmountJobs()

            if (jobs === queue.getUnlockedSlots()) {
                return false
            }

            if (!readyState.buildingQueue || !readyState.buildings) {
                return false
            }

            analyseVillageBuildings(village)
        })
    }

    const analyseVillagesInstantFinish = function () {
        const villageIds = getVillageIds()

        villageIds.forEach(function (villageId) {
            const village = $player.getVillage(villageId)
            const queue = village.buildingQueue

            if (queue.getAmountJobs()) {
                const jobs = queue.getQueue()

                jobs.forEach(function (job) {
                    if (buildingQueueService.canBeFinishedForFree(job, village)) {
                        premiumActionService.instantBuild(job, LOCATION_TYPES.MASS_SCREEN, true, villageId)
                    }
                })
            }
        })
    }

    const initializeAllVillages = function () {
        const villageIds = getVillageIds()

        villageIds.forEach(function (villageId) {
            const village = $player.getVillage(villageId)

            if (!village.isInitialized()) {
                villageService.initializeVillage(village)
            }
        })
    }

    /**
     * Generate an Array with all player's village IDs.
     *
     * @return {Array}
     */
    const getVillageIds = function () {
        const groupVillages = builderSettings[SETTINGS.GROUP_VILLAGES]
        let villages = []

        if (groupVillages) {
            villages = groupList.getGroupVillageIds(groupVillages)
            villages = villages.filter(function (vid) {
                return $player.getVillage(vid)
            })
        } else {
            utils.each($player.getVillages(), function (village) {
                villages.push(village.getId())
            })
        }

        return villages
    }

    /**
     * Loop all village buildings, start build job if available.
     *
     * @param {VillageModel} village
     */
    const analyseVillageBuildings = function (village) {
        let buildingLevels = angular.copy(village.buildingData.getBuildingLevels())
        const currentQueue = village.buildingQueue.getQueue()
        let sequence = angular.copy(VILLAGE_BUILDINGS)
        const sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]
        const activeSequenceId = builderSettings[SETTINGS.ACTIVE_SEQUENCE]
        const activeSequence = sequences[activeSequenceId]

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        activeSequence.some(function (buildingName) {
            if (++sequence[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                checkAndUpgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded && data.job) {
                        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, data.job)
                        addLog(village.getId(), data.job)
                    }
                })

                return true
            }
        })
    }

    /**
     * Init a build job
     *
     * @param {VillageModel} village
     * @param {String} buildingName - Building to be build.
     * @param {Function} callback
     */
    const checkAndUpgradeBuilding = function (village, buildingName, callback) {
        const upgradeability = checkBuildingUpgradeability(village, buildingName)

        if (upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            upgradeBuilding(village, buildingName, function (data) {
                callback(true, data)
            })
        } else if (upgradeability === UPGRADEABILITY_STATES.NOT_ENOUGH_FOOD) {
            if (builderSettings[SETTINGS.PRIORIZE_FARM]) {
                const limitFarm = buildingSequenceLimit[BUILDING_TYPES.FARM]
                const villageFarm = village.getBuildingData().getDataForBuilding(BUILDING_TYPES.FARM)

                if (villageFarm.level < limitFarm) {
                    upgradeBuilding(village, BUILDING_TYPES.FARM, function (data) {
                        callback(true, data)
                    })
                }
            }
        }

        callback(false)
    }

    const upgradeBuilding = function (village, buildingName, callback) {
        socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
            building: buildingName,
            village_id: village.getId(),
            location: LOCATION_TYPES.MASS_SCREEN,
            premium: false
        }, callback)
    }

    /**
     * Can't just use the .upgradeability value because of the preserve resources setting.
     */
    const checkBuildingUpgradeability = function (village, buildingName) {
        const buildingData = village.getBuildingData().getDataForBuilding(buildingName)

        if (buildingData.upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            const nextLevelCosts = buildingData.nextLevelCosts
            const resources = village.getResources().getComputed()

            if (
                resources.clay.currentStock - builderSettings[SETTINGS.PRESERVE_CLAY] < nextLevelCosts.clay ||
                resources.iron.currentStock - builderSettings[SETTINGS.PRESERVE_IRON] < nextLevelCosts.iron ||
                resources.wood.currentStock - builderSettings[SETTINGS.PRESERVE_WOOD] < nextLevelCosts.wood
            ) {
                return UPGRADEABILITY_STATES.NOT_ENOUGH_RESOURCES
            }
        }

        return buildingData.upgradeability
    }

    /**
     * Check if all buildings from the sequence already reached
     * the specified level.
     *
     * @param {Object} buildingLevels - Current buildings level from the village.
     * @return {Boolean} True if the levels already reached the limit.
     */
    const checkVillageBuildingLimit = function (buildingLevels) {
        for (let buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingSequenceLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    /**
     * Check if the building sequence is valid by analysing if the
     * buildings exceed the maximum level.
     *
     * @param {Array} sequence
     * @return {Boolean}
     */
    const validSequence = function (sequence) {
        const buildingData = modelDataService.getGameData().getBuildings()

        for (let i = 0; i < sequence.length; i++) {
            let building = sequence[i]

            if (++sequence[building] > buildingData[building].max_level) {
                return false
            }
        }

        return true
    }

    /**
     * Get the level max for each building.
     *
     * @param {String} sequenceId
     * @return {Object} Maximum level for each building.
     */
    const getSequenceLimit = function (sequenceId) {
        const sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]
        const sequence = sequences[sequenceId]
        let sequenceLimit = angular.copy(VILLAGE_BUILDINGS)

        sequence.forEach(function (buildingName) {
            sequenceLimit[buildingName]++
        })

        return sequenceLimit
    }

    const addLog = function (villageId, jobData) {
        let data = {
            time: timeHelper.gameTime(),
            villageId: villageId,
            building: jobData.building,
            level: jobData.level
        }

        logs.unshift(data)

        if (logs.length > LOGS_LIMIT) {
            logs.splice(logs.length - LOGS_LIMIT, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)

        return true
    }

    let builderQueue = {}

    builderQueue.start = function () {
        if (!sequencesAvail) {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_NO_SEQUENCES)
            return false
        }

        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        intervalInstantCheckId = setInterval(analyseVillagesInstantFinish, 60000 / ANALYSES_PER_MINUTE_INSTANT_FINISH)
        
        ready(function () {
            initializeAllVillages()
            analyseVillages()
            analyseVillagesInstantFinish()
        }, ['all_villages_ready'])

        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_START)
    }

    builderQueue.stop = function () {
        running = false
        clearInterval(intervalCheckId)
        clearInterval(intervalInstantCheckId)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_STOP)
    }

    builderQueue.isRunning = function () {
        return running
    }

    builderQueue.isInitialized = function () {
        return initialized
    }

    builderQueue.getSettings = function () {
        return settings
    }

    builderQueue.getLogs = function () {
        return logs
    }

    builderQueue.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS)
    }

    builderQueue.addBuildingSequence = function (id, sequence) {
        let sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]

        if (id in sequences) {
            return SEQUENCE_STATUS.SEQUENCE_EXISTS
        }

        if (!Array.isArray(sequence)) {
            return SEQUENCE_STATUS.SEQUENCE_INVALID
        }

        sequences[id] = sequence
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, id)

        return SEQUENCE_STATUS.SEQUENCE_SAVED
    }

    builderQueue.updateBuildingSequence = function (id, sequence) {
        let sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]

        if (!(id in sequences)) {
            return SEQUENCE_STATUS.SEQUENCE_NO_EXISTS
        }

        if (!Array.isArray(sequence) || !validSequence(sequence)) {
            return SEQUENCE_STATUS.SEQUENCE_INVALID
        }

        sequences[id] = sequence
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, id)

        return SEQUENCE_STATUS.SEQUENCE_SAVED
    }

    builderQueue.removeSequence = function (id) {
        let sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]

        if (!(id in sequences)) {
            return SEQUENCE_STATUS.SEQUENCE_NO_EXISTS
        }

        delete sequences[id]
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, id)
    }

    builderQueue.init = function () {
        initialized = true
        logs = Lockr.get(STORAGE_KEYS.LOGS, [], true)
        $player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates, opt) {
            builderSettings = settings.getAll()

            if (running) {
                if (updates[UPDATES.ANALYSE]) {
                    analyseVillages()
                }
            }

            if (!opt.quiet) {
                eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE)
            }
        })

        builderSettings = settings.getAll()

        for (let buildingName in BUILDING_TYPES) {
            VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
        }

        sequencesAvail = Object.keys(builderSettings[SETTINGS.BUILDING_SEQUENCES]).length
        buildingSequenceLimit = sequencesAvail ? getSequenceLimit(builderSettings[SETTINGS.ACTIVE_SEQUENCE]) : false

        $rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
            if (!running) {
                return false
            }

            setTimeout(function () {
                let village = $player.getVillage(data.village_id)
                analyseVillageBuildings(village)
            }, 1000)
        })
    }

    return builderQueue
})

define('two/builderQueue/defaultOrders', [
    'conf/buildingTypes'
], function (
    BUILDING_TYPES
) {
    let defaultSequences = {}
    
    const shuffle = function (array) {
        array.sort(() => Math.random() - 0.5)
    }

    const parseSequence = function (rawSequence) {
        let parsed = []

        for (let i = 0; i < rawSequence.length; i++) {
            let item = rawSequence[i]

            if (Array.isArray(item)) {
                shuffle(item)
                parsed = parsed.concat(item)
            } else {
                parsed.push(item)
            }
        }

        return parsed
    }

    const parseSequences = function (rawSequences) {
        let parsed = {}

        for (let i in rawSequences) {
            if (hasOwn.call(rawSequences, i)) {
                parsed[i] = parseSequence(rawSequences[i])
            }
        }

        return parsed
    }

    defaultSequences['Essential'] = [
        BUILDING_TYPES.HEADQUARTER, // 1
        BUILDING_TYPES.FARM, // 1
        BUILDING_TYPES.WAREHOUSE, // 1
        BUILDING_TYPES.RALLY_POINT, // 1
        BUILDING_TYPES.BARRACKS, // 1
        [
            // Quest: The Resources
            BUILDING_TYPES.TIMBER_CAMP, // 1
            BUILDING_TYPES.TIMBER_CAMP, // 2
            BUILDING_TYPES.CLAY_PIT, // 1
            BUILDING_TYPES.IRON_MINE, // 1

            BUILDING_TYPES.HEADQUARTER, // 2
            BUILDING_TYPES.RALLY_POINT, // 2
        ],
        [
            // Quest: First Steps
            BUILDING_TYPES.FARM, // 2
            BUILDING_TYPES.WAREHOUSE, // 2
            
            // Quest: Laying Down Foundation
            BUILDING_TYPES.CLAY_PIT, // 2
            BUILDING_TYPES.IRON_MINE, // 2
        ],
        [
            // Quest: More Resources
            BUILDING_TYPES.TIMBER_CAMP, // 3
            BUILDING_TYPES.CLAY_PIT, // 3
            BUILDING_TYPES.IRON_MINE, // 3
            
            // Quest: Resource Building
            BUILDING_TYPES.WAREHOUSE, // 3
            BUILDING_TYPES.TIMBER_CAMP, // 4
            BUILDING_TYPES.CLAY_PIT, // 4
            BUILDING_TYPES.IRON_MINE, // 4
        ],
        [
            // Quest: Get an Overview
            BUILDING_TYPES.WAREHOUSE, // 4
            BUILDING_TYPES.TIMBER_CAMP, // 5
            BUILDING_TYPES.CLAY_PIT, // 5
            BUILDING_TYPES.IRON_MINE, // 5

            // Quest: Capital
            BUILDING_TYPES.FARM, // 3
            BUILDING_TYPES.WAREHOUSE, // 5
            BUILDING_TYPES.HEADQUARTER, // 3
        ],
        [
            // Quest: The Hero
            BUILDING_TYPES.STATUE, // 1

            // Quest: Resource Expansions
            BUILDING_TYPES.TIMBER_CAMP, // 6
            BUILDING_TYPES.CLAY_PIT, // 6
            BUILDING_TYPES.IRON_MINE, // 6
        ],
        [
            // Quest: Military
            BUILDING_TYPES.BARRACKS, // 2

            // Quest: The Hospital
            BUILDING_TYPES.HEADQUARTER, // 4
            BUILDING_TYPES.TIMBER_CAMP, // 7
            BUILDING_TYPES.CLAY_PIT, // 7
            BUILDING_TYPES.IRON_MINE, // 7
            BUILDING_TYPES.FARM, // 4
            BUILDING_TYPES.HOSPITAL, // 1
        ],
        [
            // Quest: Resources
            BUILDING_TYPES.TIMBER_CAMP, // 8
            BUILDING_TYPES.CLAY_PIT, // 8
            BUILDING_TYPES.IRON_MINE, // 8
        ],
        // Quest: The Wall
        BUILDING_TYPES.WAREHOUSE, // 6
        BUILDING_TYPES.HEADQUARTER, // 5
        BUILDING_TYPES.WALL, // 1
        [
            // Quest: Village Improvements
            BUILDING_TYPES.TIMBER_CAMP, // 9
            BUILDING_TYPES.CLAY_PIT, // 9
            BUILDING_TYPES.IRON_MINE, // 9
            BUILDING_TYPES.TIMBER_CAMP, // 10
            BUILDING_TYPES.CLAY_PIT, // 10
            BUILDING_TYPES.IRON_MINE, // 10
            BUILDING_TYPES.FARM, // 5
        ],
        BUILDING_TYPES.FARM, // 6
        BUILDING_TYPES.FARM, // 7
        [
            // Quest: Hard work
            BUILDING_TYPES.TIMBER_CAMP, // 11
            BUILDING_TYPES.CLAY_PIT, // 11
            BUILDING_TYPES.IRON_MINE, // 11
            BUILDING_TYPES.TIMBER_CAMP, // 12
            BUILDING_TYPES.CLAY_PIT, // 12
            BUILDING_TYPES.IRON_MINE, // 12
        ],
        [
            // Quest: The way of defence
            BUILDING_TYPES.BARRACKS, // 3

            BUILDING_TYPES.WAREHOUSE, // 7
            BUILDING_TYPES.WAREHOUSE, // 8
            BUILDING_TYPES.FARM, // 8
            BUILDING_TYPES.WAREHOUSE, // 9
            BUILDING_TYPES.WAREHOUSE, // 10
        ],
        [
            // Quest: Market Barker
            BUILDING_TYPES.HEADQUARTER, // 6
            BUILDING_TYPES.MARKET, // 1

            // Quest: Preparations
            BUILDING_TYPES.BARRACKS, // 4
            BUILDING_TYPES.WALL, // 2
            BUILDING_TYPES.WALL, // 3
        ],
        [
            BUILDING_TYPES.FARM, // 9
            BUILDING_TYPES.FARM, // 10

            BUILDING_TYPES.BARRACKS, // 5
            BUILDING_TYPES.WAREHOUSE, // 11
            BUILDING_TYPES.FARM, // 11
        ],
        [
            BUILDING_TYPES.BARRACKS, // 6
            BUILDING_TYPES.WAREHOUSE, // 12
            BUILDING_TYPES.FARM, // 12

            BUILDING_TYPES.BARRACKS, // 7
            BUILDING_TYPES.WAREHOUSE, // 13
            BUILDING_TYPES.FARM, // 13
        ],
        [
            BUILDING_TYPES.WALL, // 4
            BUILDING_TYPES.WALL, // 5
            BUILDING_TYPES.WALL, // 6

            BUILDING_TYPES.MARKET, // 2
            BUILDING_TYPES.MARKET, // 3
            BUILDING_TYPES.MARKET, // 4
        ],
        [
            BUILDING_TYPES.BARRACKS, // 8
            BUILDING_TYPES.BARRACKS, // 9

            BUILDING_TYPES.HEADQUARTER, // 7
            BUILDING_TYPES.HEADQUARTER, // 8
        ],
        [
            BUILDING_TYPES.TAVERN, // 1
            BUILDING_TYPES.TAVERN, // 2
            BUILDING_TYPES.TAVERN, // 3

            BUILDING_TYPES.RALLY_POINT, // 3
        ],
        [
            BUILDING_TYPES.BARRACKS, // 10
            BUILDING_TYPES.BARRACKS, // 11

            BUILDING_TYPES.WAREHOUSE, // 14
            BUILDING_TYPES.FARM, // 14
        ],
        [
            BUILDING_TYPES.WAREHOUSE, // 15
            BUILDING_TYPES.FARM, // 15

            BUILDING_TYPES.BARRACKS, // 12
            BUILDING_TYPES.BARRACKS, // 13
        ],
        [
            BUILDING_TYPES.STATUE, // 2
            BUILDING_TYPES.STATUE, // 3

            BUILDING_TYPES.WALL, // 7
            BUILDING_TYPES.WALL, // 8
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 9
            BUILDING_TYPES.HEADQUARTER, // 10

            BUILDING_TYPES.WAREHOUSE, // 16
            BUILDING_TYPES.FARM, // 16
            BUILDING_TYPES.FARM, // 17
        ],
        [
            BUILDING_TYPES.IRON_MINE, // 13
            BUILDING_TYPES.IRON_MINE, // 14
            BUILDING_TYPES.IRON_MINE, // 15

            BUILDING_TYPES.WAREHOUSE, // 17
        ],
        [
            BUILDING_TYPES.BARRACKS, // 14
            BUILDING_TYPES.BARRACKS, // 15

            BUILDING_TYPES.WAREHOUSE, // 18
            BUILDING_TYPES.FARM, // 18
        ],
        [
            BUILDING_TYPES.WALL, // 9
            BUILDING_TYPES.WALL, // 10

            BUILDING_TYPES.TAVERN, // 4
            BUILDING_TYPES.TAVERN, // 5
            BUILDING_TYPES.TAVERN, // 6
        ],
        [
            BUILDING_TYPES.MARKET, // 5
            BUILDING_TYPES.MARKET, // 6
            BUILDING_TYPES.MARKET, // 7

            BUILDING_TYPES.WAREHOUSE, // 19
            BUILDING_TYPES.FARM, // 19
            BUILDING_TYPES.WAREHOUSE, // 20
            BUILDING_TYPES.FARM, // 20
            BUILDING_TYPES.WAREHOUSE, // 21
            BUILDING_TYPES.FARM, // 21
        ],
        [
            BUILDING_TYPES.IRON_MINE, // 16
            BUILDING_TYPES.IRON_MINE, // 17
            BUILDING_TYPES.IRON_MINE, // 18

            BUILDING_TYPES.RALLY_POINT, // 4
        ],
        [
            BUILDING_TYPES.BARRACKS, // 16
            BUILDING_TYPES.BARRACKS, // 17

            BUILDING_TYPES.FARM, // 22
            BUILDING_TYPES.FARM, // 23
            BUILDING_TYPES.FARM, // 24
            BUILDING_TYPES.FARM, // 25
        ],
        [
            BUILDING_TYPES.WAREHOUSE, // 22
            BUILDING_TYPES.WAREHOUSE, // 23

            BUILDING_TYPES.HEADQUARTER, // 11
            BUILDING_TYPES.HEADQUARTER, // 12
        ],
        [
            BUILDING_TYPES.STATUE, // 4
            BUILDING_TYPES.STATUE, // 5

            BUILDING_TYPES.FARM, // 26
            BUILDING_TYPES.BARRACKS, // 18
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 14
            BUILDING_TYPES.HEADQUARTER, // 15

            BUILDING_TYPES.FARM, // 27
            BUILDING_TYPES.BARRACKS, // 19
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 15
            BUILDING_TYPES.HEADQUARTER, // 16

            BUILDING_TYPES.BARRACKS, // 20

            BUILDING_TYPES.HEADQUARTER, // 17
            BUILDING_TYPES.HEADQUARTER, // 18
            BUILDING_TYPES.HEADQUARTER, // 19
            BUILDING_TYPES.HEADQUARTER, // 20
        ],
        [
            BUILDING_TYPES.ACADEMY, // 1

            BUILDING_TYPES.FARM, // 28
            BUILDING_TYPES.WAREHOUSE, // 23
            BUILDING_TYPES.WAREHOUSE, // 24
            BUILDING_TYPES.WAREHOUSE, // 25
        ],
        [
            BUILDING_TYPES.MARKET, // 8
            BUILDING_TYPES.MARKET, // 9
            BUILDING_TYPES.MARKET, // 10

            BUILDING_TYPES.TIMBER_CAMP, // 13
            BUILDING_TYPES.CLAY_PIT, // 13
            BUILDING_TYPES.IRON_MINE, // 19
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 14
            BUILDING_TYPES.CLAY_PIT, // 14
            BUILDING_TYPES.TIMBER_CAMP, // 15
            BUILDING_TYPES.CLAY_PIT, // 15

            BUILDING_TYPES.TIMBER_CAMP, // 16
            BUILDING_TYPES.TIMBER_CAMP, // 17
        ],
        [
            BUILDING_TYPES.WALL, // 11
            BUILDING_TYPES.WALL, // 12

            BUILDING_TYPES.MARKET, // 11
            BUILDING_TYPES.MARKET, // 12
            BUILDING_TYPES.MARKET, // 13
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 18
            BUILDING_TYPES.CLAY_PIT, // 16
            BUILDING_TYPES.TIMBER_CAMP, // 19
            BUILDING_TYPES.CLAY_PIT, // 17

            BUILDING_TYPES.TAVERN, // 7
            BUILDING_TYPES.TAVERN, // 8
            BUILDING_TYPES.TAVERN, // 9
        ],
        [
            BUILDING_TYPES.WALL, // 13
            BUILDING_TYPES.WALL, // 14

            BUILDING_TYPES.TIMBER_CAMP, // 20
            BUILDING_TYPES.CLAY_PIT, // 18
            BUILDING_TYPES.IRON_MINE, // 20
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 21
            BUILDING_TYPES.CLAY_PIT, // 19
            BUILDING_TYPES.IRON_MINE, // 21

            BUILDING_TYPES.BARRACKS, // 21
            BUILDING_TYPES.BARRACKS, // 22
            BUILDING_TYPES.BARRACKS, // 23
        ],
        [
            BUILDING_TYPES.FARM, // 29
            BUILDING_TYPES.WAREHOUSE, // 26
            BUILDING_TYPES.WAREHOUSE, // 27

            BUILDING_TYPES.TAVERN, // 10
            BUILDING_TYPES.TAVERN, // 11
            BUILDING_TYPES.TAVERN, // 12
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 22
            BUILDING_TYPES.CLAY_PIT, // 20
            BUILDING_TYPES.IRON_MINE, // 22

            BUILDING_TYPES.TIMBER_CAMP, // 23
            BUILDING_TYPES.CLAY_PIT, // 21
            BUILDING_TYPES.IRON_MINE, // 23
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 24
            BUILDING_TYPES.CLAY_PIT, // 22
            BUILDING_TYPES.IRON_MINE, // 24

            BUILDING_TYPES.BARRACKS, // 24
            BUILDING_TYPES.BARRACKS, // 25
        ],
        [
            BUILDING_TYPES.FARM, // 30
            BUILDING_TYPES.WAREHOUSE, // 28
            BUILDING_TYPES.WAREHOUSE, // 29

            BUILDING_TYPES.WALL, // 15
            BUILDING_TYPES.WALL, // 16
            BUILDING_TYPES.WALL, // 17
            BUILDING_TYPES.WALL, // 18
        ],
        [
            BUILDING_TYPES.TAVERN, // 13
            BUILDING_TYPES.TAVERN, // 14

            BUILDING_TYPES.RALLY_POINT, // 5

            BUILDING_TYPES.TIMBER_CAMP, // 25
            BUILDING_TYPES.CLAY_PIT, // 23
            BUILDING_TYPES.IRON_MINE, // 25
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 26
            BUILDING_TYPES.CLAY_PIT, // 24
            BUILDING_TYPES.IRON_MINE, // 26

            BUILDING_TYPES.TIMBER_CAMP, // 27
            BUILDING_TYPES.CLAY_PIT, // 25
            BUILDING_TYPES.IRON_MINE, // 27
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 28
            BUILDING_TYPES.CLAY_PIT, // 26
            BUILDING_TYPES.IRON_MINE, // 28

            BUILDING_TYPES.TIMBER_CAMP, // 29
            BUILDING_TYPES.CLAY_PIT, // 27
            BUILDING_TYPES.CLAY_PIT, // 28
            BUILDING_TYPES.IRON_MINE, // 29
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 30
            BUILDING_TYPES.CLAY_PIT, // 29
            BUILDING_TYPES.CLAY_PIT, // 30
            BUILDING_TYPES.IRON_MINE, // 30

            BUILDING_TYPES.WALL, // 19
            BUILDING_TYPES.WALL, // 20
        ]
    ]

    defaultSequences['Full Village'] = [
        [
            BUILDING_TYPES.HOSPITAL, // 2
            BUILDING_TYPES.HOSPITAL, // 3
            BUILDING_TYPES.HOSPITAL, // 4
            BUILDING_TYPES.HOSPITAL, // 5

            BUILDING_TYPES.MARKET, // 14
            BUILDING_TYPES.MARKET, // 15
            BUILDING_TYPES.MARKET, // 16
            BUILDING_TYPES.MARKET, // 17
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 21
            BUILDING_TYPES.HEADQUARTER, // 22
            BUILDING_TYPES.HEADQUARTER, // 23
            BUILDING_TYPES.HEADQUARTER, // 24
            BUILDING_TYPES.HEADQUARTER, // 25

            BUILDING_TYPES.PRECEPTORY, // 1

            BUILDING_TYPES.HOSPITAL, // 6
            BUILDING_TYPES.HOSPITAL, // 7
            BUILDING_TYPES.HOSPITAL, // 8
            BUILDING_TYPES.HOSPITAL, // 9
            BUILDING_TYPES.HOSPITAL, // 10
        ],
        [
            BUILDING_TYPES.MARKET, // 18
            BUILDING_TYPES.MARKET, // 19
            BUILDING_TYPES.MARKET, // 20
            BUILDING_TYPES.MARKET, // 21

            BUILDING_TYPES.PRECEPTORY, // 2
            BUILDING_TYPES.PRECEPTORY, // 3

            BUILDING_TYPES.MARKET, // 22
            BUILDING_TYPES.MARKET, // 23
            BUILDING_TYPES.MARKET, // 24
            BUILDING_TYPES.MARKET, // 25
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 26
            BUILDING_TYPES.HEADQUARTER, // 27
            BUILDING_TYPES.HEADQUARTER, // 28
            BUILDING_TYPES.HEADQUARTER, // 29
            BUILDING_TYPES.HEADQUARTER, // 30

            BUILDING_TYPES.PRECEPTORY, // 4
            BUILDING_TYPES.PRECEPTORY, // 5
            BUILDING_TYPES.PRECEPTORY, // 6
            BUILDING_TYPES.PRECEPTORY, // 7
            BUILDING_TYPES.PRECEPTORY, // 8
            BUILDING_TYPES.PRECEPTORY, // 9
            BUILDING_TYPES.PRECEPTORY, // 10
        ]
    ]

    Array.prototype.unshift.apply(
        defaultSequences['Full Village'],
        defaultSequences['Essential']
    )

    defaultSequences['Essential Without Wall'] =
        defaultSequences['Essential'].filter(function (building) {
            return building !== BUILDING_TYPES.WALL
        })

    defaultSequences['Full Wall'] = [
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL // 20
    ]

    defaultSequences['Full Farm'] = [
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM // 30
    ]

    return parseSequences(defaultSequences)
})

define('two/builderQueue/events', [], function () {
    angular.extend(eventTypeProvider, {
        BUILDER_QUEUE_JOB_STARTED: 'builder_queue_job_started',
        BUILDER_QUEUE_START: 'builder_queue_start',
        BUILDER_QUEUE_STOP: 'builder_queue_stop',
        BUILDER_QUEUE_UNKNOWN_SETTING: 'builder_queue_settings_unknown_setting',
        BUILDER_QUEUE_CLEAR_LOGS: 'builder_queue_clear_logs',
        BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED: 'builder_queue_building_orders_updated',
        BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED: 'builder_queue_building_orders_added',
        BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED: 'builder_queue_building_orders_removed',
        BUILDER_QUEUE_SETTINGS_CHANGE: 'builder_queue_settings_change',
        BUILDER_QUEUE_NO_SEQUENCES: 'builder_queue_no_sequences',
        COMMAND_QUEUE_ADD_INVALID_OFFICER: 'command_queue_add_invalid_officer',
        COMMAND_QUEUE_ADD_RELOCATE_DISABLED: 'command_queue_add_relocate_disabled'
    })
})


define('two/builderQueue/ui', [
    'two/ui',
    'two/builderQueue',
    'two/utils',
    'two/ready',
    'two/Settings',
    'two/builderQueue/settings',
    'two/builderQueue/settings/map',
    'two/builderQueue/sequenceStatus',
    'conf/buildingTypes',
    'two/EventScope',
    'queues/EventQueue',
    'helper/time'
], function (
    interfaceOverflow,
    builderQueue,
    utils,
    ready,
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    SEQUENCE_STATUS,
    BUILDING_TYPES,
    EventScope,
    eventQueue,
    timeHelper
) {
    let $scope
    let $button
    let groupList = modelDataService.getGroupList()
    let buildingsLevelPoints = {}
    let running = false
    let gameDataBuildings
    let editorView = {
        sequencesAvail: true,
        modal: {}
    }
    let settings
    let settingsView = {
        sequencesAvail: true
    }
    let logsView = {}
    const TAB_TYPES = {
        SETTINGS: 'settings',
        SEQUENCES: 'sequences',
        LOGS: 'logs'
    }
    let villagesInfo = {}
    let villagesLabel = {}
    let unsavedChanges = false
    let oldCloseWindow
    let ignoreInputChange = false

    // TODO: make it shared with other modules
    const loadVillageInfo = function (villageId) {
        if (villagesInfo[villageId]) {
            return villagesInfo[villageId]
        }

        villagesInfo[villageId] = true
        villagesLabel[villageId] = 'LOADING...'

        socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
            my_village_id: modelDataService.getSelectedVillage().getId(),
            village_id: villageId,
            num_reports: 1
        }, function (data) {
            villagesInfo[villageId] = {
                x: data.village_x,
                y: data.village_y,
                name: data.village_name,
                last_report: data.last_reports[0]
            }

            villagesLabel[villageId] = `${data.village_name} (${data.village_x}|${data.village_y})`
        })
    }

    const buildingLevelReached = function (building, level) {
        const buildingData = modelDataService.getSelectedVillage().getBuildingData()
        return buildingData.getBuildingLevel(building) >= level
    }

    const buildingLevelProgress = function (building, level) {
        const queue = modelDataService.getSelectedVillage().getBuildingQueue().getQueue()
        let progress = false

        queue.some(function (job) {
            if (job.building === building && job.level === level) {
                return progress = true
            }
        })

        return progress
    }

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    const getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
    }

    const moveArrayItem = function (obj, oldIndex, newIndex) {
        if (newIndex >= obj.length) {
            let i = newIndex - obj.length + 1
            
            while (i--) {
                obj.push(undefined)
            }
        }

        obj.splice(newIndex, 0, obj.splice(oldIndex, 1)[0])
    }

    const parseBuildingSequence = function (sequence) {
        return sequence.map(function (item) {
            return item.building
        })
    }

    const createBuildingSequence = function (sequenceId, sequence) {
        const status = builderQueue.addBuildingSequence(sequenceId, sequence)

        switch (status) {
            case SEQUENCE_STATUS.SEQUENCE_SAVED: {
                return true
            }
            case SEQUENCE_STATUS.SEQUENCE_EXISTS: {
                utils.notif('error', $filter('i18n')('error_sequence_exists', $rootScope.loc.ale, 'builder_queue'))
                return false
            }
            case SEQUENCE_STATUS.SEQUENCE_INVALID: {
                utils.notif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, 'builder_queue'))
                return false
            }
        }
    }

    const selectSome = function (obj) {
        for (let i in obj) {
            if (hasOwn.call(obj, i)) {
                return i
            }
        }

        return false
    }

    settingsView.generateSequences = function () {
        const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        const sequencesAvail = Object.keys(sequences).length

        settingsView.sequencesAvail = sequencesAvail

        if (!sequencesAvail) {
            return false
        }

        settingsView.generateBuildingSequence()
        settingsView.generateBuildingSequenceFinal()
        settingsView.updateVisibleBuildingSequence()
    }

    settingsView.generateBuildingSequence = function () {
        const sequenceId = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        const buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        const buildingData = modelDataService.getGameData().getBuildings()
        let buildingLevels = {}

        settingsView.sequencesAvail = !!buildingSequenceRaw

        if (!settingsView.sequencesAvail) {
            return false
        }

        for (let building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        settingsView.buildingSequence = buildingSequenceRaw.map(function (building) {
            let level = ++buildingLevels[building]
            let price = buildingData[building].individual_level_costs[level]
            let state = 'not-reached'

            if (buildingLevelReached(building, level)) {
                state = 'reached'
            } else if (buildingLevelProgress(building, level)) {
                state = 'progress'
            }

            return {
                level: level,
                price: buildingData[building].individual_level_costs[level],
                building: building,
                duration: timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1],
                state: state
            }
        })
    }

    settingsView.generateBuildingSequenceFinal = function (_sequenceId) {
        const selectedSequence = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        const sequenceBuildings = $scope.settings[SETTINGS.BUILDING_SEQUENCES][_sequenceId || selectedSequence]
        let sequenceObj = {}
        let sequence = []
        
        for (let building in gameDataBuildings) {
            sequenceObj[building] = {
                level: 0,
                order: gameDataBuildings[building].order,
                resources: {
                    wood: 0,
                    clay: 0,
                    iron: 0,
                    food: 0
                },
                points: 0,
                build_time: 0
            }
        }

        sequenceBuildings.forEach(function (building) {
            let level = ++sequenceObj[building].level
            let costs = gameDataBuildings[building].individual_level_costs[level]

            sequenceObj[building].resources.wood += parseInt(costs.wood, 10)
            sequenceObj[building].resources.clay += parseInt(costs.clay, 10)
            sequenceObj[building].resources.iron += parseInt(costs.iron, 10)
            sequenceObj[building].resources.food += parseInt(costs.food, 10)
            sequenceObj[building].build_time += parseInt(costs.build_time, 10)
            sequenceObj[building].points += buildingsLevelPoints[building][level - 1]
        })

        for (let building in sequenceObj) {
            if (sequenceObj[building].level !== 0) {
                sequence.push({
                    building: building,
                    level: sequenceObj[building].level,
                    order: sequenceObj[building].order,
                    resources: sequenceObj[building].resources,
                    points: sequenceObj[building].points,
                    build_time: sequenceObj[building].build_time
                })
            }
        }

        settingsView.buildingSequenceFinal = sequence
    }

    settingsView.updateVisibleBuildingSequence = function () {
        const offset = $scope.pagination.buildingSequence.offset
        const limit = $scope.pagination.buildingSequence.limit

        settingsView.visibleBuildingSequence = settingsView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequence.count = settingsView.buildingSequence.length
    }

    settingsView.generateBuildingsLevelPoints = function () {
        const $gameData = modelDataService.getGameData()
        let buildingTotalPoints

        for(let buildingName in $gameData.data.buildings) {
            let buildingData = $gameData.getBuildingDataForBuilding(buildingName)
            buildingTotalPoints = 0
            buildingsLevelPoints[buildingName] = []

            for (let level = 1; level <= buildingData.max_level; level++) {
                let currentLevelPoints  = getLevelScale(buildingData.points, buildingData.points_factor, level)
                let levelPoints = currentLevelPoints - buildingTotalPoints
                buildingTotalPoints += levelPoints

                buildingsLevelPoints[buildingName].push(levelPoints)
            }
        }
    }

    editorView.moveUp = function () {
        let copy = angular.copy(editorView.buildingSequence)
        let changed = false

        for (let i = 0; i < copy.length; i++) {
            let item = copy[i]

            if (!item.checked) {
                continue
            }

            if (i === 0) {
                continue
            }

            if (copy[i - 1].checked) {
                continue
            }

            if (copy[i - 1].building === item.building) {
                copy[i - 1].level++
                item.level--
                changed = true
            }

            moveArrayItem(copy, i, i - 1)
        }

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()

        if (changed) {
            unsavedChanges = true
        }
    }

    editorView.moveDown = function () {
        let copy = angular.copy(editorView.buildingSequence)
        let changed = false

        for (let i = copy.length - 1; i >= 0; i--) {
            let item = copy[i]

            if (!item.checked) {
                continue
            }

            if (i === copy.length - 1) {
                continue
            }

            if (copy[i + 1].checked) {
                continue
            }

            if (copy[i + 1].building === item.building) {
                copy[i + 1].level--
                item.level++
                changed = true
            }

            moveArrayItem(copy, i, i + 1)
        }

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()
        
        if (changed) {
            unsavedChanges = true
        }
    }

    editorView.addBuilding = function (building, position, amount = 1) {
        const index = position - 1
        let newSequence = editorView.buildingSequence.slice()
        let buildingData = {
            level: null,
            building: building,
            checked: false
        }

        for (let i = 0; i < amount; i++) {
            newSequence.splice(index, 0, buildingData)
        }

        editorView.buildingSequence = editorView.updateLevels(newSequence, building)
        editorView.updateVisibleBuildingSequence()
        unsavedChanges = true

        return true
    }

    editorView.removeBuilding = function (index) {
        const building = editorView.buildingSequence[index].building

        editorView.buildingSequence.splice(index, 1)
        editorView.buildingSequence = editorView.updateLevels(editorView.buildingSequence, building)

        editorView.updateVisibleBuildingSequence()
        unsavedChanges = true
    }

    editorView.updateLevels = function (sequence, building) {
        let buildingLevel = 0
        let modifiedSequence = []

        for (let i = 0; i < sequence.length; i++) {
            let item = sequence[i]

            if (item.building === building) {
                if (buildingLevel < gameDataBuildings[building].max_level) {
                    modifiedSequence.push({
                        level: ++buildingLevel,
                        building: building,
                        checked: false
                    })
                }
            } else {
                modifiedSequence.push(item)
            }
        }

        return modifiedSequence
    }

    editorView.generateBuildingSequence = function () {
        const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        const sequencesAvail = Object.keys(sequences).length

        editorView.sequencesAvail = sequencesAvail

        if (!sequencesAvail) {
            return false
        }

        const sequenceId = editorView.selectedSequence.value
        const buildingSequenceRaw = sequences[sequenceId]
        let buildingLevels = {}

        for (let building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        editorView.buildingSequence = buildingSequenceRaw.map(function (building) {
            return {
                level: ++buildingLevels[building],
                building: building,
                checked: false
            }
        })

        editorView.updateVisibleBuildingSequence()
    }

    editorView.updateVisibleBuildingSequence = function () {
        const offset = $scope.pagination.buildingSequenceEditor.offset
        const limit = $scope.pagination.buildingSequenceEditor.limit

        editorView.visibleBuildingSequence = editorView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequenceEditor.count = editorView.buildingSequence.length
    }

    editorView.updateBuildingSequence = function () {
        const selectedSequence = editorView.selectedSequence.value
        const parsedSequence = parseBuildingSequence(editorView.buildingSequence)
        const status = builderQueue.updateBuildingSequence(selectedSequence, parsedSequence)

        switch (status) {
            case SEQUENCE_STATUS.SEQUENCE_SAVED: {
                unsavedChanges = false
                break
            }
            case SEQUENCE_STATUS.SEQUENCE_NO_EXISTS: {
                utils.notif('error', $filter('i18n')('error_sequence_no_exits', $rootScope.loc.ale, 'builder_queue'))
                break
            }
            case SEQUENCE_STATUS.SEQUENCE_INVALID: {
                utils.notif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, 'builder_queue'))
                break
            }
        }
    }

    editorView.modal.removeSequence = function () {
        let modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('title', $rootScope.loc.ale, 'builder_queue_remove_sequence_modal')
        modalScope.text = $filter('i18n')('text', $rootScope.loc.ale, 'builder_queue_remove_sequence_modal')
        modalScope.submitText = $filter('i18n')('remove', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.switchColors = true

        modalScope.submit = function () {
            modalScope.closeWindow()
            builderQueue.removeSequence(editorView.selectedSequence.value)
            unsavedChanges = false
        }

        modalScope.cancel = function () {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    editorView.modal.addBuilding = function () {
        let modalScope = $rootScope.$new()
        modalScope.buildings = []
        modalScope.position = editorView.lastAddedIndex
        modalScope.indexLimit = editorView.buildingSequence.length + 1
        modalScope.buildingsData = modelDataService.getGameData().getBuildings()
        modalScope.amount = 1
        modalScope.selectedBuilding = {
            name: $filter('i18n')(editorView.lastAddedBuilding, $rootScope.loc.ale, 'building_names'),
            value: editorView.lastAddedBuilding
        }

        for (let building in gameDataBuildings) {
            modalScope.buildings.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        modalScope.add = function () {
            const building = modalScope.selectedBuilding.value
            const position = modalScope.position
            const amount = modalScope.amount
            const buildingName = $filter('i18n')(building, $rootScope.loc.ale, 'building_names')
            const buildingLimit = gameDataBuildings[building].max_level

            editorView.lastAddedBuilding = building
            editorView.lastAddedIndex = position

            if (editorView.addBuilding(building, position, amount)) {
                modalScope.closeWindow()
                utils.notif('success', $filter('i18n')('add_building_success', $rootScope.loc.ale, 'builder_queue', buildingName, position))
            } else {
                utils.notif('error', $filter('i18n')('add_building_limit_exceeded', $rootScope.loc.ale, 'builder_queue', buildingName, buildingLimit))
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_add_building_modal', modalScope)
    }

    editorView.modal.nameSequence = function () {
        const nameSequence = function () {
            let modalScope = $rootScope.$new()
            const selectedSequenceName = editorView.selectedSequence.name
            const selectedSequence = $scope.settings[SETTINGS.BUILDING_SEQUENCES][selectedSequenceName]
            
            modalScope.name = selectedSequenceName

            modalScope.submit = function () {
                if (modalScope.name.length < 3) {
                    utils.notif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, 'builder_queue'))
                    return false
                }

                if (createBuildingSequence(modalScope.name, selectedSequence)) {
                    modalScope.closeWindow()
                }
            }

            windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
        }

        if (unsavedChanges) {
            let modalScope = $rootScope.$new()
            modalScope.title = $filter('i18n')('clone_warn_changed_sequence_title', $rootScope.loc.ale, 'builder_queue')
            modalScope.text = $filter('i18n')('clone_warn_changed_sequence_text', $rootScope.loc.ale, 'builder_queue')
            modalScope.submitText = $filter('i18n')('clone', $rootScope.loc.ale, 'builder_queue')
            modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')

            modalScope.submit = function () {
                modalScope.closeWindow()
                nameSequence()
            }

            modalScope.cancel = function () {
                modalScope.closeWindow()
            }

            windowManagerService.getModal('modal_attention', modalScope)
        } else {
            nameSequence()
        }
    }

    logsView.updateVisibleLogs = function () {
        const offset = $scope.pagination.logs.offset
        const limit = $scope.pagination.logs.limit

        logsView.visibleLogs = logsView.logs.slice(offset, offset + limit)
        $scope.pagination.logs.count = logsView.logs.length

        logsView.visibleLogs.forEach(function (log) {
            if (log.villageId) {
                loadVillageInfo(log.villageId)
            }
        })
    }

    logsView.clearLogs = function () {
        builderQueue.clearLogs()
    }

    const createSequence = function () {
        let modalScope = $rootScope.$new()
        const initialSequence = [BUILDING_TYPES.HEADQUARTER]

        modalScope.name = ''
        
        modalScope.submit = function () {
            if (modalScope.name.length < 3) {
                utils.notif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, 'builder_queue'))
                return false
            }

            if (createBuildingSequence(modalScope.name, initialSequence)) {
                $scope.settings[SETTINGS.ACTIVE_SEQUENCE] = { name: modalScope.name, value: modalScope.name }
                $scope.settings[SETTINGS.BUILDING_SEQUENCES][modalScope.name] = initialSequence

                saveSettings()

                settingsView.selectedSequence = { name: modalScope.name, value: modalScope.name }
                editorView.selectedSequence = { name: modalScope.name, value: modalScope.name }

                settingsView.generateSequences()
                editorView.generateBuildingSequence()

                modalScope.closeWindow()
                selectTab(TAB_TYPES.SEQUENCES)
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        unsavedChanges = false
    }

    const switchBuilder = function () {
        if (builderQueue.isRunning()) {
            builderQueue.stop()
        } else {
            builderQueue.start()
        }
    }

    const confirmDiscardModal = function (onDiscard, onCancel) {
        let modalScope = $rootScope.$new()
        modalScope.title = $filter('i18n')('discard_changes_title', $rootScope.loc.ale, 'builder_queue')
        modalScope.text = $filter('i18n')('discard_changes_text', $rootScope.loc.ale, 'builder_queue')
        modalScope.submitText = $filter('i18n')('discard', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.switchColors = true

        modalScope.submit = function () {
            modalScope.closeWindow()
            onDiscard && onDiscard()
        }

        modalScope.cancel = function () {
            modalScope.closeWindow()
            onCancel && onCancel()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    const confirmCloseWindow = function () {
        if (unsavedChanges) {
            confirmDiscardModal(function onDiscard () {
                oldCloseWindow()
            })
        } else {
            oldCloseWindow()
        }
    }

    const eventHandlers = {
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                type: 'groups',
                disabled: true
            })
        },
        updateSequences: function () {
            const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            
            $scope.sequences = Settings.encodeList(sequences, {
                type: 'keys',
                disabled: false
            })
        },
        generateBuildingSequences: function () {
            settingsView.generateSequences()
        },
        generateBuildingSequencesEditor: function () {
            editorView.generateBuildingSequence()
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
            logsView.updateVisibleLogs()
        },
        clearLogs: function () {
            utils.notif('success', $filter('i18n')('logs_cleared', $rootScope.loc.ale, 'builder_queue'))
            eventHandlers.updateLogs()
        },
        buildingSequenceUpdate: function (event, sequenceId) {
            const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = sequences[sequenceId]

            if ($scope.settings[SETTINGS.ACTIVE_SEQUENCE].value === sequenceId) {
                settingsView.generateSequences()
            }

            utils.notif('success', $filter('i18n')('sequence_updated', $rootScope.loc.ale, 'builder_queue', sequenceId))
        },
        buildingSequenceAdd: function (event, sequenceId) {
            const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = sequences[sequenceId]
            eventHandlers.updateSequences()
            utils.notif('success', $filter('i18n')('sequence_created', $rootScope.loc.ale, 'builder_queue', sequenceId))
        },
        buildingSequenceRemoved: function (event, sequenceId) {
            delete $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]

            const substituteSequence = selectSome($scope.settings[SETTINGS.BUILDING_SEQUENCES])
            editorView.selectedSequence = { name: substituteSequence, value: substituteSequence }
            eventHandlers.updateSequences()
            editorView.generateBuildingSequence()

            if (settings.get(SETTINGS.ACTIVE_SEQUENCE) === sequenceId) {
                settings.set(SETTINGS.ACTIVE_SEQUENCE, substituteSequence, {
                    quiet: true
                })
                settingsView.generateSequences()
            }

            utils.notif('success', $filter('i18n')('sequence_removed', $rootScope.loc.ale, 'builder_queue', sequenceId))
        },
        saveSettings: function () {
            utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'builder_queue'))
        },
        started: function () {
            $scope.running = true
        },
        stopped: function () {
            $scope.running = false
        }
    }

    const init = function () {
        gameDataBuildings = modelDataService.getGameData().getBuildings()
        settingsView.generateBuildingsLevelPoints()
        settings = builderQueue.getSettings()

        $button = interfaceOverflow.addMenuButton('Budowniczy', 30)
        $button.addEventListener('click', buildWindow)

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_START, function () {
            running = true
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
            utils.notif('success', $filter('i18n')('started', $rootScope.loc.ale, 'builder_queue'))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
            utils.notif('success', $filter('i18n')('stopped', $rootScope.loc.ale, 'builder_queue'))
        })

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `<div id=\"two-builder-queue\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Budowniczy</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main small-select\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SEQUENCES)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SEQUENCES}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SEQUENCES}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SEQUENCES}\">{{ TAB_TYPES.SEQUENCES | i18n:loc.ale:'builder_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ TAB_TYPES.LOGS | i18n:loc.ale:'common' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><h5 class=\"twx-section\">{{ 'settings' | i18n:loc.ale:'builder_queue' }}</h5><table class=\"settings tbl-border-light tbl-striped\"><col width=\"40%\"><col><col width=\"60px\"><tr><td><span class=\"ff-cell-fix\">{{ 'settings_village_groups' | i18n:loc.ale:'builder_queue' }}</span><td colspan=\"2\" class=\"text-right\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_VILLAGES]\" drop-down=\"true\"></div><tr ng-show=\"settingsView.sequencesAvail\"><td><span class=\"ff-cell-fix\">{{ 'settings_building_sequence' | i18n:loc.ale:'builder_queue' }}</span><td colspan=\"2\" class=\"text-right\"><div select=\"\" list=\"sequences\" selected=\"settings[SETTINGS.ACTIVE_SEQUENCE]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'settings_preserve_wood' | i18n:loc.ale:'builder_queue' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_WOOD].min\" max=\"settingsMap[SETTINGS.PRESERVE_WOOD].max\" value=\"settings[SETTINGS.PRESERVE_WOOD]\" enabled=\"true\"></div><td><input type=\"number\" class=\"preserve-resource textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_WOOD]\"><tr><td><span class=\"ff-cell-fix\">{{ 'settings_preserve_clay' | i18n:loc.ale:'builder_queue' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_CLAY].min\" max=\"settingsMap[SETTINGS.PRESERVE_CLAY].max\" value=\"settings[SETTINGS.PRESERVE_CLAY]\" enabled=\"true\"></div><td><input type=\"number\" class=\"preserve-resource textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_CLAY]\"><tr><td><span class=\"ff-cell-fix\">{{ 'settings_preserve_iron' | i18n:loc.ale:'builder_queue' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_IRON].min\" max=\"settingsMap[SETTINGS.PRESERVE_IRON].max\" value=\"settings[SETTINGS.PRESERVE_IRON]\" enabled=\"true\"></div><td><input type=\"number\" class=\"preserve-resource textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_IRON]\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'settings_priorize_farm' | i18n:loc.ale:'builder_queue' }}</span><td class=\"text-center\"><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.PRIORIZE_FARM]\" vertical=\"false\" size=\"'56x28'\"></div></table><h5 class=\"twx-section\">{{ 'settings_building_sequence' | i18n:loc.ale:'builder_queue' }}</h5><p ng-show=\"!settingsView.sequencesAvail\" class=\"text-center\"><a href=\"#\" class=\"btn-orange btn-border create-sequence\" ng-click=\"createSequence()\">{{ 'create_sequence' | i18n:loc.ale:'builder_queue' }}</a><div ng-if=\"settingsView.sequencesAvail && settingsView.visibleBuildingSequence.length\"><div class=\"page-wrap\" pagination=\"pagination.buildingSequence\"></div><table class=\"tbl-border-light header-center building-sequence\"><col width=\"5%\"><col><col width=\"7%\"><col width=\"13%\"><col width=\"8%\"><col width=\"9%\"><col width=\"9%\"><col width=\"9%\"><col width=\"6%\"><tr><th tooltip=\"\" tooltip-content=\"{{ 'position' | i18n:loc.ale:'builder_queue' }}\">#<th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'duration' | i18n:loc.ale:'common' }}<th>{{ 'points' | i18n:loc.ale:'common' }}<th><span class=\"icon-26x26-resource-wood\"></span><th><span class=\"icon-26x26-resource-clay\"></span><th><span class=\"icon-26x26-resource-iron\"></span><th><span class=\"icon-26x26-resource-food\"></span><tr ng-repeat=\"item in settingsView.visibleBuildingSequence track by $index\" class=\"{{ item.state }}\"><td>{{ pagination.buildingSequence.offset + $index + 1 }}<td><span class=\"building-icon icon-20x20-building-{{ item.building }}\"></span> {{ item.building | i18n:loc.ale:'building_names' }}<td>{{ item.level }}<td>{{ item.duration }}<td class=\"green\">+{{ item.levelPoints | number }}<td>{{ item.price.wood | number }}<td>{{ item.price.clay | number }}<td>{{ item.price.iron | number }}<td>{{ item.price.food | number }}</table><div class=\"page-wrap\" pagination=\"pagination.buildingSequence\"></div></div><h5 ng-if=\"settingsView.sequencesAvail && settingsView.visibleBuildingSequence.length\" class=\"twx-section\">{{ 'settings_building_sequence_final' | i18n:loc.ale:'builder_queue' }}</h5><table ng-if=\"settingsView.sequencesAvail && settingsView.visibleBuildingSequence.length\" class=\"tbl-border-light tbl-striped header-center building-sequence-final\"><col><col width=\"5%\"><col width=\"12%\"><col width=\"8%\"><col width=\"11%\"><col width=\"11%\"><col width=\"11%\"><col width=\"7%\"><tr><th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'duration' | i18n:loc.ale:'common' }}<th>{{ 'points' | i18n:loc.ale:'common' }}<th><span class=\"icon-26x26-resource-wood\"></span><th><span class=\"icon-26x26-resource-clay\"></span><th><span class=\"icon-26x26-resource-iron\"></span><th><span class=\"icon-26x26-resource-food\"></span><tr ng-repeat=\"item in settingsView.buildingSequenceFinal | orderBy:'order'\"><td><span class=\"building-icon icon-20x20-building-{{ item.building }}\"></span> {{ item.building | i18n:loc.ale:'building_names' }}<td>{{ item.level }}<td>{{ item.build_time | readableSecondsFilter }}<td class=\"green\">+{{ item.points | number }}<td>{{ item.resources.wood | number }}<td>{{ item.resources.clay | number }}<td>{{ item.resources.iron | number }}<td>{{ item.resources.food | number }}</table><p ng-show=\"settingsView.sequencesAvail && !settingsView.visibleBuildingSequence.length\" class=\"text-center\">{{ 'empty_sequence' | i18n:loc.ale:'builder_queue' }}</div><div ng-show=\"selectedTab === TAB_TYPES.SEQUENCES\"><h5 class=\"twx-section\">{{ 'sequences_edit_sequence' | i18n:loc.ale:'builder_queue' }}</h5><p ng-show=\"!editorView.sequencesAvail\" class=\"text-center\"><a class=\"btn btn-orange create-sequence\" ng-click=\"createSequence()\">{{ 'create_sequence' | i18n:loc.ale:'builder_queue' }}</a><table ng-if=\"editorView.sequencesAvail\" class=\"tbl-border-light tbl-striped editor-select-sequence\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'sequences_select_edit' | i18n:loc.ale:'builder_queue' }}</span><td><div class=\"select-sequence-editor\" select=\"\" list=\"sequences\" selected=\"editorView.selectedSequence\" drop-down=\"true\"></div><tr><td class=\"text-center\"><a class=\"btn btn-orange create-sequence\" ng-click=\"createSequence()\">{{ 'create_sequence' | i18n:loc.ale:'builder_queue' }}</a><td class=\"text-center\"><a class=\"btn btn-orange clone-sequence\" ng-click=\"editorView.modal.nameSequence()\">{{ 'clone_sequence' | i18n:loc.ale:'builder_queue' }}</a><td class=\"text-center\"><a class=\"btn btn-red remove-sequence\" ng-click=\"editorView.modal.removeSequence()\">{{ 'remove_sequence' | i18n:loc.ale:'builder_queue' }}</a></table><div ng-if=\"editorView.sequencesAvail\"><div class=\"page-wrap\" pagination=\"pagination.buildingSequenceEditor\"></div><table ng-show=\"editorView.visibleBuildingSequence.length\" class=\"tbl-border-light tbl-striped header-center building-sequence-editor\"><col width=\"5%\"><col width=\"5%\"><col><col width=\"7%\"><col width=\"10%\"><tr><th><th tooltip=\"\" tooltip-content=\"{{ 'position' | i18n:loc.ale:'builder_queue' }}\">#<th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'actions' | i18n:loc.ale:'common' }}<tr ng-repeat=\"item in editorView.visibleBuildingSequence track by $index\" ng-class=\"{'selected': item.checked}\"><td><label class=\"size-26x26 btn-orange icon-26x26-checkbox\" ng-class=\"{'icon-26x26-checkbox-checked': item.checked}\"><input type=\"checkbox\" ng-model=\"item.checked\"></label><td>{{ pagination.buildingSequenceEditor.offset + $index + 1 }}<td><span class=\"building-icon icon-20x20-building-{{ item.building }}\"></span> {{ item.building | i18n:loc.ale:'building_names' }}<td>{{ item.level }}<td><a href=\"#\" class=\"size-20x20 btn-red icon-20x20-close\" ng-click=\"editorView.removeBuilding(pagination.buildingSequenceEditor.offset + $index)\" tooltip=\"\" tooltip-content=\"{{ 'remove_building' | i18n:loc.ale:'builder_queue' }}\"></a></table><div class=\"page-wrap\" pagination=\"pagination.buildingSequenceEditor\"></div><p ng-show=\"!editorView.visibleBuildingSequence.length\" class=\"text-center\"><a class=\"btn btn-border btn-orange\" ng-click=\"editorView.modal.addBuilding()\">{{ 'sequences_add_building' | i18n:loc.ale:'builder_queue' }}</a></div></div><div ng-show=\"selectedTab === TAB_TYPES.LOGS\" class=\"rich-text\"><div class=\"page-wrap\" pagination=\"pagination.logs\"></div><p class=\"text-center\" ng-show=\"!logsView.logs.length\">{{ 'logs_no_builds' | i18n:loc.ale:'builder_queue' }}<table class=\"tbl-border-light tbl-striped header-center logs\" ng-show=\"logsView.logs.length\"><col width=\"40%\"><col width=\"30%\"><col width=\"5%\"><col width=\"25%\"><col><thead><tr><th>{{ 'village' | i18n:loc.ale:'common' }}<th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'started_at' | i18n:loc.ale:'common' }}<tbody><tr ng-repeat=\"log in logsView.logs\"><td><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a><td><span class=\"building-icon icon-20x20-building-{{ log.building }}\"></span> {{ log.building | i18n:loc.ale:'building_names' }}<td>{{ log.level }}<td>{{ log.time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</table><div class=\"page-wrap\" pagination=\"pagination.logs\"></div></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS && settingsView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS && settingsView.sequencesAvail\"><a href=\"#\" ng-class=\"{false:'btn-orange', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchBuilder()\"><span ng-show=\"running\">{{ 'pause' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'start' | i18n:loc.ale:'common' }}</span></a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"logsView.clearLogs()\">{{ 'logs_clear' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"editorView.moveUp()\">{{ 'sequences_move_up' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"editorView.moveDown()\">{{ 'sequences_move_down' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"editorView.modal.addBuilding()\">{{ 'sequences_add_building' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"editorView.updateBuildingSequence()\">{{ 'save' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_add_building_modal', `<div id=\"add-building-modal\" class=\"win-content\"><header class=\"win-head\"><h3>{{ 'title' | i18n:loc.ale:'builder_queue_add_building_modal' }}</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap unit-operate-slider\"><table class=\"tbl-border-light tbl-striped header-center\"><col width=\"15%\"><col><col width=\"15%\"><tr><td>{{ 'building' | i18n:loc.ale:'common' }}<td colspan=\"2\"><div select=\"\" list=\"buildings\" selected=\"selectedBuilding\" drop-down=\"true\"></div><tr><td>{{ 'position' | i18n:loc.ale:'builder_queue' }}<td><div range-slider=\"\" min=\"1\" max=\"indexLimit\" value=\"position\" enabled=\"true\"></div><td><input type=\"number\" class=\"input-border text-center\" ng-model=\"position\"><tr><td>{{ 'amount' | i18n:loc.ale:'builder_queue' }}<td><div range-slider=\"\" min=\"1\" max=\"buildingsData[selectedBuilding.value].max_level\" value=\"amount\" enabled=\"true\"></div><td><input type=\"number\" class=\"input-border text-center\" ng-model=\"amount\"></table></div></div></div><footer class=\"win-foot sprite-fill\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-red btn-border btn-premium\" ng-click=\"closeWindow()\">{{ 'cancel' | i18n:loc.ale:'common' }}</a><li><a href=\"#\" class=\"btn-orange btn-border\" ng-click=\"add()\">{{ 'add' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_name_sequence_modal', `<div id=\"name-sequence-modal\" class=\"win-content\"><header class=\"win-head\"><h3>{{ 'title' | i18n:loc.ale:'builder_queue_name_sequence_modal' }}</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap\"><div class=\"box-border-light input-wrapper name_preset\"><form ng-submit=\"submit()\"><input focus=\"true\" ng-model=\"name\" minlength=\"3\"></form></div></div></div></div><footer class=\"win-foot sprite-fill\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-red btn-border btn-premium\" ng-click=\"closeWindow()\">{{ 'cancel' | i18n:loc.ale:'common' }}</a><li><a href=\"#\" class=\"btn-orange btn-border\" ng-click=\"submit()\">{{ 'add' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-builder-queue tr.reached td{background-color:#b9af7e}#two-builder-queue tr.progress td{background-color:#af9d57}#two-builder-queue .building-sequence,#two-builder-queue .building-sequence-final,#two-builder-queue .building-sequence-editor,#two-builder-queue .logs{margin-bottom:10px}#two-builder-queue .building-sequence td,#two-builder-queue .building-sequence-final td,#two-builder-queue .building-sequence-editor td,#two-builder-queue .logs td,#two-builder-queue .building-sequence th,#two-builder-queue .building-sequence-final th,#two-builder-queue .building-sequence-editor th,#two-builder-queue .logs th{text-align:center;line-height:20px}#two-builder-queue .building-sequence-editor .selected td{background-color:#b9af7e}#two-builder-queue .editor-select-sequence{margin-bottom:13px}#two-builder-queue a.btn{height:28px;line-height:28px;padding:0 10px}#two-builder-queue .select-sequence-editor{text-align:center;margin-top:1px}#two-builder-queue .create-sequence{padding:8px 20px 8px 20px}#two-builder-queue table.settings td{padding:1px 5px}#two-builder-queue table.settings td.text-right{text-align:right}#two-builder-queue table.settings div[switch-slider]{display:inline-block;margin-top:2px}#two-builder-queue .small-select a.select-handler{height:28px;line-height:28px}#two-builder-queue .small-select a.select-button{height:28px}#two-builder-queue input.preserve-resource{width:70px;height:32px}#two-builder-queue .icon-26x26-resource-wood,#two-builder-queue .icon-26x26-resource-clay,#two-builder-queue .icon-26x26-resource-iron,#two-builder-queue .icon-26x26-resource-food{transform:scale(.8);top:-1px}#add-building-modal td{text-align:center}#add-building-modal .select-wrapper{width:250px}#add-building-modal input[type="text"]{width:60px}')
    }

    const buildWindow = function () {
        const activeSequence = settings.get(SETTINGS.ACTIVE_SEQUENCE)

        $scope = $rootScope.$new()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.SETTINGS = SETTINGS
        $scope.running = running
        $scope.pagination = {}
        $scope.settingsMap = settings.settingsMap

        $scope.villagesLabel = villagesLabel
        $scope.villagesInfo = villagesInfo

        $scope.editorView = editorView
        $scope.editorView.buildingSequence = {}
        $scope.editorView.visibleBuildingSequence = []
        $scope.editorView.selectedSequence = { name: activeSequence, value: activeSequence }

        $scope.editorView.lastAddedBuilding = BUILDING_TYPES.HEADQUARTER
        $scope.editorView.lastAddedIndex = 1

        $scope.settingsView = settingsView
        $scope.settingsView.buildingSequence = {}
        $scope.settingsView.buildingSequenceFinal = {}

        $scope.logsView = logsView
        $scope.logsView.logs = builderQueue.getLogs()

        // methods
        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.saveSettings = saveSettings
        $scope.createSequence = createSequence
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        settings.injectScope($scope)
        eventHandlers.updateGroups()
        eventHandlers.updateSequences()

        $scope.pagination.buildingSequence = {
            count: settingsView.buildingSequence.length,
            offset: 0,
            loader: settingsView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.buildingSequenceEditor = {
            count: editorView.buildingSequence.length,
            offset: 0,
            loader: editorView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.logs = {
            count: logsView.logs.length,
            offset: 0,
            loader: logsView.updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        logsView.updateVisibleLogs()

        settingsView.generateSequences()
        editorView.generateBuildingSequence()

        let eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_UPGRADING, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_LEVEL_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_TEARING_DOWN, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.clearLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, eventHandlers.buildingSequenceUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, eventHandlers.buildingSequenceAdd)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, eventHandlers.buildingSequenceRemoved)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE, eventHandlers.saveSettings)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_START, eventHandlers.started)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_STOP, eventHandlers.stopped)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)

        oldCloseWindow = $scope.closeWindow
        $scope.closeWindow = confirmCloseWindow

        $scope.$watch('settings[SETTINGS.ACTIVE_SEQUENCE].value', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                eventHandlers.generateBuildingSequences()
            }
        })

        $scope.$watch('editorView.selectedSequence.value', function (newValue, oldValue) {
            if (ignoreInputChange) {
                ignoreInputChange = false
                return
            }

            if (newValue !== oldValue) {
                if (unsavedChanges) {
                    confirmDiscardModal(function onDiscard () {
                        eventHandlers.generateBuildingSequencesEditor()
                        unsavedChanges = false
                    }, function onCancel () {
                        $scope.editorView.selectedSequence = { name: oldValue, value: oldValue }
                        ignoreInputChange = true
                    })
                } else {
                    eventHandlers.generateBuildingSequencesEditor()
                }
            }
        })
    }

    return init
})

define('two/builderQueue/settings', [], function () {
    return {
        GROUP_VILLAGES: 'group_villages',
        ACTIVE_SEQUENCE: 'building_sequence',
        BUILDING_SEQUENCES: 'building_orders',
        PRESERVE_WOOD: 'preserve_wood',
        PRESERVE_CLAY: 'preserve_clay',
        PRESERVE_IRON: 'preserve_iron',
        PRIORIZE_FARM: 'priorize_farm'
    }
})

define('two/builderQueue/settings/updates', [], function () {
    return {
        ANALYSE: 'analyse'
    }
})

define('two/builderQueue/settings/map', [
    'two/builderQueue/defaultOrders',
    'two/builderQueue/settings',
    'two/builderQueue/settings/updates'
], function (
    DEFAULT_ORDERS,
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.GROUP_VILLAGES]: {
            default: false,
            inputType: 'select',
            disabledOption: true,
            type: 'groups',
            updates: [UPDATES.ANALYSE]
        },
        [SETTINGS.ACTIVE_SEQUENCE]: {
            default: 'Essential',
            inputType: 'select',
            updates: [UPDATES.ANALYSE]
        },
        [SETTINGS.BUILDING_SEQUENCES]: {
            default: DEFAULT_ORDERS,
            inputType: 'buildingOrder',
            updates: [UPDATES.ANALYSE]
        },
        [SETTINGS.PRESERVE_WOOD]: {
            default: 0,
            updates: [UPDATES.ANALYSE],
            inputType: 'number',
            min: 0,
            max: 600000
        },
        [SETTINGS.PRESERVE_CLAY]: {
            default: 0,
            updates: [UPDATES.ANALYSE],
            inputType: 'number',
            min: 0,
            max: 600000
        },
        [SETTINGS.PRESERVE_IRON]: {
            default: 0,
            updates: [UPDATES.ANALYSE],
            inputType: 'number',
            min: 0,
            max: 600000
        },
        [SETTINGS.PRIORIZE_FARM]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.ANALYSE]
        }
    }
})

define('two/builderQueue/sequenceStatus', [], function () {
    return {
        SEQUENCE_NO_EXISTS: 'sequence_no_exists',
        SEQUENCE_EXISTS: 'sequence_exists',
        SEQUENCE_INVALID: 'sequence_invalid',
        SEQUENCE_SAVED: 'sequence_saved'
    }
})

require([
    'two/ready',
    'two/builderQueue',
    'two/builderQueue/ui',
    'two/builderQueue/events'
], function (
    ready,
    builderQueue,
    builderQueueInterface
) {
    if (builderQueue.isInitialized()) {
        return false
    }

    ready(function () {
        builderQueue.init()
        builderQueueInterface()
    })
})

define('two/commandQueue', [
    'two/utils',
    'two/commandQueue/types/dates',
    'two/commandQueue/types/events',
    'two/commandQueue/types/filters',
    'two/commandQueue/types/commands',
    'two/commandQueue/storageKeys',
    'two/commandQueue/errorCodes',
    'queues/EventQueue',
    'helper/time',
    'helper/math',
    'struct/MapData',
    'Lockr',
    'conf/buildingTypes',
    'conf/officerTypes',
    'conf/unitTypes'
], function (
    utils,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES,
    COMMAND_TYPES,
    STORAGE_KEYS,
    ERROR_CODES,
    eventQueue,
    timeHelper,
    $math,
    mapData,
    Lockr,
    BUILDING_TYPES,
    OFFICER_TYPES,
    UNIT_TYPES
) {
    const CHECKS_PER_SECOND = 10
    const COMMAND_TYPE_LIST = Object.values(COMMAND_TYPES)
    const DATE_TYPE_LIST = Object.values(DATE_TYPES)
    const UNIT_TYPE_LIST = Object.values(UNIT_TYPES)
    const OFFICER_TYPE_LIST = Object.values(OFFICER_TYPES)
    const BUILDING_TYPE_LIST = Object.values(BUILDING_TYPES)
    let waitingCommands = []
    let waitingCommandsObject = {}
    let sentCommands = []
    let expiredCommands = []
    let running = false
    let timeOffset

    const commandFilters = {
        [FILTER_TYPES.SELECTED_VILLAGE]: function (command) {
            return command.origin.id === modelDataService.getSelectedVillage().getId()
        },
        [FILTER_TYPES.BARBARIAN_TARGET]: function (command) {
            return !command.target.character_id
        },
        [FILTER_TYPES.ALLOWED_TYPES]: function (command, options) {
            return options[FILTER_TYPES.ALLOWED_TYPES][command.type]
        },
        [FILTER_TYPES.ATTACK]: function (command) {
            return command.type !== COMMAND_TYPES.ATTACK
        },
        [FILTER_TYPES.SUPPORT]: function (command) {
            return command.type !== COMMAND_TYPES.SUPPORT
        },
        [FILTER_TYPES.RELOCATE]: function (command) {
            return command.type !== COMMAND_TYPES.RELOCATE
        },
        [FILTER_TYPES.TEXT_MATCH]: function (command, options) {
            let show = true
            const keywords = options[FILTER_TYPES.TEXT_MATCH].toLowerCase().split(/\W/)

            const searchString = [
                command.origin.name,
                command.origin.x + '|' + command.origin.y,
                command.origin.character_name || '',
                command.target.name,
                command.target.x + '|' + command.target.y,
                command.target.character_name || '',
                command.target.tribe_name || '',
                command.target.tribe_tag || ''
            ].join('').toLowerCase()

            keywords.some(function (keyword) {
                if (keyword.length && !searchString.includes(keyword)) {
                    show = false
                    return true
                }
            })

            return show
        }
    }

    const timeToSend = function (sendTime) {
        return sendTime < (timeHelper.gameTime() + timeOffset)
    }

    const sortWaitingQueue = function () {
        waitingCommands = waitingCommands.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    const pushWaitingCommand = function (command) {
        waitingCommands.push(command)
    }

    const pushCommandObject = function (command) {
        waitingCommandsObject[command.id] = command
    }

    const pushSentCommand = function (command) {
        sentCommands.push(command)
    }

    const pushExpiredCommand = function (command) {
        expiredCommands.push(command)
    }

    const storeWaitingQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_COMMANDS, waitingCommands)
    }

    const storeSentQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_SENT, sentCommands)
    }

    const storeExpiredQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_EXPIRED, expiredCommands)
    }

    const loadStoredCommands = function () {
        const storedQueue = Lockr.get(STORAGE_KEYS.QUEUE_COMMANDS, [], true)

        utils.each(storedQueue, function (command) {
            if (timeHelper.gameTime() > command.sendTime) {
                commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
            } else {
                pushWaitingCommand(command)
                pushCommandObject(command)
            }
        })
    }
    
    

    const parseDynamicUnits = function (command) {
        const playerVillages = modelDataService.getVillages()
        const village = playerVillages[command.origin.id]

        if (!village) {
            return EVENT_CODES.NOT_OWN_VILLAGE
        }

        const villageUnits = village.unitInfo.units
        let parsedUnits = {}
        let error = false

        utils.each(command.units, function (amount, unit) {
            if (amount === '*') {
                amount = villageUnits[unit].available

                if (amount === 0) {
                    return
                }
            } else if (amount < 0) {
                amount = villageUnits[unit].available - Math.abs(amount)

                if (amount < 0) {
                    error = EVENT_CODES.NOT_ENOUGH_UNITS
                    return false
                }
            } else if (amount > 0) {
                if (amount > villageUnits[unit].available) {
                    error = EVENT_CODES.NOT_ENOUGH_UNITS
                    return false
                }
            }

            parsedUnits[unit] = amount
        })

        if (angular.equals({}, parsedUnits)) {
            error = EVENT_CODES.NOT_ENOUGH_UNITS
        }

        return error || parsedUnits
    }

    const listenCommands = function () {
        setInterval(function () {
            if (!waitingCommands.length) {
                return
            }

            waitingCommands.some(function (command) {
                if (timeToSend(command.sendTime)) {
                    if (running) {
                        commandQueue.sendCommand(command)
                    } else {
                        commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                    }
                } else {
                    return true
                }
            })
        }, 1000 / CHECKS_PER_SECOND)
    }

    const validAxisCoord = function (input) {
        return !isNaN(input) && input > 0 && input < 1000
    }

    const validCoords = function (input) {
        return hasOwn.call(input, 'x') && hasOwn.call(input, 'y') && validAxisCoord(input.x) && validAxisCoord(input.y)
    }

    let commandQueue = {
        initialized: false
    }

    commandQueue.init = function () {
        timeOffset = utils.getTimeOffset()
        commandQueue.initialized = true
        sentCommands = Lockr.get(STORAGE_KEYS.QUEUE_SENT, [], true)
        expiredCommands = Lockr.get(STORAGE_KEYS.QUEUE_EXPIRED, [], true)

        loadStoredCommands()
        listenCommands()

        window.addEventListener('beforeunload', function (event) {
            if (running && waitingCommands.length) {
                event.returnValue = true
            }
        })
    }

    commandQueue.sendCommand = function (command) {
        const units = parseDynamicUnits(command)

        // units === EVENT_CODES.*
        if (typeof units === 'string') {
            return commandQueue.expireCommand(command, units)
        }

        command.units = units

        socketService.emit(routeProvider.SEND_CUSTOM_ARMY, {
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: command.catapultTarget
        })

        pushSentCommand(command)
        storeSentQueue()

        commandQueue.removeCommand(command, EVENT_CODES.COMMAND_SENT)
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND, command)
    }

    commandQueue.expireCommand = function (command, eventCode) {
        pushExpiredCommand(command)
        storeExpiredQueue()

        commandQueue.removeCommand(command, eventCode)
    }

    commandQueue.addCommand = function (origin, target, date, dateType, units, officers, commandType, catapultTarget) {
        let parsedUnits = {}
        let parsedOfficers = {}

        return new Promise(function (resolve, reject) {
            if (!validCoords(origin)) {
                return reject(ERROR_CODES.INVALID_ORIGIN)
            }

            if (!validCoords(target)) {
                return reject(ERROR_CODES.INVALID_TARGET)
            }

            if (!utils.isValidDateTime(date)) {
                return reject(ERROR_CODES.INVALID_DATE)
            }

            if (angular.isObject(units)) {
                const validUnitType = utils.each(units, function (amount, unitName) {
                    if (!UNIT_TYPE_LIST.includes(unitName)) {
                        return false
                    }

                    amount = isNaN(amount) ? amount : parseInt(amount, 10)

                    if (amount === '*' || typeof amount === 'number' && amount !== 0) {
                        parsedUnits[unitName] = amount
                    }
                })

                if (!validUnitType) {
                    return reject(ERROR_CODES.INVALID_UNIT_TYPE)
                }
            }

            if (angular.equals(parsedUnits, {})) {
                return reject(ERROR_CODES.NO_UNITS)
            }

            if (angular.isObject(officers)) {
                const validOfficerType = utils.each(officers, function (status, officerName) {
                    if (!OFFICER_TYPE_LIST.includes(officerName)) {
                        return false
                    }

                    if (officers[officerName]) {
                        parsedOfficers[officerName] = true
                    }
                })

                if (!validOfficerType) {
                    return reject(ERROR_CODES.INVALID_OFFICER_TYPE)
                }
            }

            if (!COMMAND_TYPE_LIST.includes(commandType)) {
                return reject(ERROR_CODES.INVALID_COMMAND_TYPE)
            }

            if (commandType === COMMAND_TYPES.RELOCATE && !modelDataService.getWorldConfig().isRelocateUnitsEnabled()) {
                return reject(ERROR_CODES.RELOCATE_DISABLED)
            }

            if (commandType === COMMAND_TYPES.ATTACK && parsedOfficers[OFFICER_TYPES.SUPPORTER]) {
                delete parsedOfficers[OFFICER_TYPES.SUPPORTER]
            }

            if (typeof catapultTarget === 'string' && !BUILDING_TYPE_LIST.includes(catapultTarget)) {
                return reject(ERROR_CODES.INVALID_CATAPULT_TARGET)
            }

            if (commandType === COMMAND_TYPES.ATTACK && parsedUnits[UNIT_TYPES.CATAPULT]) {
                catapultTarget = catapultTarget || BUILDING_TYPES.HEADQUARTER
            } else {
                catapultTarget = false
            }

            if (!DATE_TYPE_LIST.includes(dateType)) {
                return reject(ERROR_CODES.INVALID_DATE_TYPE)
            }

            Promise.all([
                new Promise((resolve) => mapData.loadTownDataAsync(origin.x, origin.y, 1, 1, resolve)),
                new Promise((resolve) => mapData.loadTownDataAsync(target.x, target.y, 1, 1, resolve))
            ]).then(function (villages) {
                origin = villages[0]
                target = villages[1]

                if (!origin) {
                    return reject(ERROR_CODES.INVALID_ORIGIN)
                }

                if (!target) {
                    return reject(ERROR_CODES.INVALID_TARGET)
                }

                const inputTime = utils.getTimeFromString(date)
                const travelTime = utils.getTravelTime(origin, target, parsedUnits, commandType, parsedOfficers, true)
                const sendTime = dateType === DATE_TYPES.ARRIVE ? (inputTime - travelTime) : inputTime
                const arriveTime = dateType === DATE_TYPES.ARRIVE ? inputTime : (inputTime + travelTime)

                if (timeToSend(sendTime)) {
                    return reject(ERROR_CODES.ALREADY_SENT)
                }

                const command = {
                    id: utils.guid(),
                    travelTime: travelTime,
                    arriveTime: arriveTime,
                    sendTime: sendTime,
                    origin: origin,
                    target: target,
                    date: date,
                    dateType: dateType,
                    units: parsedUnits,
                    officers: parsedOfficers,
                    type: commandType,
                    catapultTarget: catapultTarget,
                    countdown: sendTime - timeHelper.gameTime(),
                }

                pushWaitingCommand(command)
                pushCommandObject(command)
                sortWaitingQueue()
                storeWaitingQueue()
                resolve(command)
            })
        })
    }

    commandQueue.removeCommand = function (command, eventCode) {
        delete waitingCommandsObject[command.id]

        const removed = waitingCommands.some(function (waitingCommand, index) {
            if (waitingCommand.id == command.id) {
                waitingCommands.splice(index, 1)
                storeWaitingQueue()
                return true
            }
        })

        if (removed) {
            switch (eventCode) {
                case EVENT_CODES.TIME_LIMIT: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, command)
                    break
                }
                case EVENT_CODES.NOT_OWN_VILLAGE: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, command)
                    break
                }
                case EVENT_CODES.NOT_ENOUGH_UNITS: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, command)
                    break
                }
                case EVENT_CODES.COMMAND_REMOVED: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE, command)
                    break
                }
            }
        } else {
            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, command)
        }

        return removed
    }

    commandQueue.clearRegisters = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_EXPIRED, [])
        Lockr.set(STORAGE_KEYS.QUEUE_SENT, [])
        expiredCommands = []
        sentCommands = []
    }

    commandQueue.start = function (disableNotif) {
        running = true
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_START, {
            disableNotif: !!disableNotif
        })
    }

    commandQueue.stop = function () {
        running = false
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_STOP)
    }

    commandQueue.isRunning = function () {
        return running
    }

    commandQueue.getWaitingCommands = function () {
        return waitingCommands
    }

    commandQueue.getWaitingCommandsObject = function () {
        return waitingCommandsObject
    }

    commandQueue.getSentCommands = function () {
        return sentCommands
    }

    commandQueue.getExpiredCommands = function () {
        return expiredCommands
    }

    /**
     * @param {Array} _deep - recursive command list
     */
    commandQueue.filterCommands = function (filterId, filterArgs, _deep) {
        const filter = commandFilters[filterId]
        const commands = _deep || waitingCommands

        return commands.filter(function (command) {
            return filter(command, filterArgs)
        })
    }

    return commandQueue
})

define('two/commandQueue/events', [], function () {
    angular.extend(eventTypeProvider, {
        COMMAND_QUEUE_SEND: 'commandqueue_send',
        COMMAND_QUEUE_SEND_TIME_LIMIT: 'commandqueue_send_time_limit',
        COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE: 'commandqueue_send_not_own_village',
        COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH: 'commandqueue_send_no_units_enough',
        COMMAND_QUEUE_ADD: 'commandqueue_add',
        COMMAND_QUEUE_ADD_INVALID_ORIGIN: 'commandqueue_add_invalid_origin',
        COMMAND_QUEUE_ADD_INVALID_TARGET: 'commandqueue_add_invalid_target',
        COMMAND_QUEUE_ADD_INVALID_DATE: 'commandqueue_add_invalid_date',
        COMMAND_QUEUE_ADD_NO_UNITS: 'commandqueue_add_no_units',
        COMMAND_QUEUE_ADD_ALREADY_SENT: 'commandqueue_add_already_sent',
        COMMAND_QUEUE_ADD_RELOCATE_DISABLED: 'command_queue_add_relocate_disabled',
        COMMAND_QUEUE_REMOVE: 'commandqueue_remove',
        COMMAND_QUEUE_REMOVE_ERROR: 'commandqueue_remove_error',
        COMMAND_QUEUE_START: 'commandqueue_start',
        COMMAND_QUEUE_STOP: 'commandqueue_stop'
    })
})

define('two/commandQueue/ui', [
    'two/ui',
    'two/commandQueue',
    'two/EventScope',
    'two/utils',
    'two/commandQueue/types/dates',
    'two/commandQueue/types/events',
    'two/commandQueue/types/filters',
    'two/commandQueue/types/commands',
    'two/commandQueue/storageKeys',
    'two/commandQueue/errorCodes',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
    'helper/util',
    'Lockr'
], function (
    interfaceOverflow,
    commandQueue,
    EventScope,
    utils,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES,
    COMMAND_TYPES,
    STORAGE_KEYS,
    ERROR_CODES,
    eventQueue,
    mapData,
    $timeHelper,
    util,
    Lockr
) {
    let $scope
    let $button
    let $gameData = modelDataService.getGameData()
    let $player
    let orderedUnitNames = $gameData.getOrderedUnitNames()
    let orderedOfficerNames = $gameData.getOrderedOfficerNames()
    let presetList = modelDataService.getPresetList()
    let mapSelectedVillage = false
    let unitOrder
    let commandData
    const TAB_TYPES = {
        ADD: 'add',
        WAITING: 'waiting',
        LOGS: 'logs'
    }
    const DEFAULT_TAB = TAB_TYPES.ADD
    const DEFAULT_CATAPULT_TARGET = 'wall'
    let attackableBuildingsList = []
    let unitList = {}
    let officerList = {}
    let timeOffset
    let activeFilters
    let filtersData
    const travelTimeArmy = {
        light_cavalry: { light_cavalry: 1 },
        heavy_cavalry: { heavy_cavalry: 1 },
        archer: { archer: 1 },
        sword: { sword: 1 },
        ram: { ram: 1 },
        snob: { snob: 1 },
        trebuchet: { trebuchet: 1 }
    }
    const FILTER_ORDER = [
        FILTER_TYPES.SELECTED_VILLAGE,
        FILTER_TYPES.BARBARIAN_TARGET,
        FILTER_TYPES.ALLOWED_TYPES,
        FILTER_TYPES.TEXT_MATCH
    ]

    const setMapSelectedVillage = function (event, menu) {
        mapSelectedVillage = menu.data
    }

    const unsetMapSelectedVillage = function () {
        mapSelectedVillage = false
    }

    /**
     * @param {Number=} _ms - Optional time to be formated instead of the game date.
     * @return {String}
     */
    const formatedDate = function (_ms) {
        const date = new Date(_ms || ($timeHelper.gameTime() + utils.getTimeOffset()))

        const rawMS = date.getMilliseconds()
        const ms = $timeHelper.zerofill(rawMS - (rawMS % 100), 3)
        const sec = $timeHelper.zerofill(date.getSeconds(), 2)
        const min = $timeHelper.zerofill(date.getMinutes(), 2)
        const hour = $timeHelper.zerofill(date.getHours(), 2)
        const day = $timeHelper.zerofill(date.getDate(), 2)
        const month = $timeHelper.zerofill(date.getMonth() + 1, 2)
        const year = date.getFullYear()

        return hour + ':' + min + ':' + sec + ':' + ms + ' ' + day + '/' + month + '/' + year
    }

    const addDateDiff = function (date, diff) {
        if (!utils.isValidDateTime(date)) {
            return ''
        }

        date = utils.getTimeFromString(date)
        date += diff

        return formatedDate(date)
    }

    const updateTravelTimes = function () {
        $scope.isValidDate = utils.isValidDateTime(commandData.date)

        if (!commandData.origin || !commandData.target) {
            return
        }

        const commandTime = $scope.isValidDate ? utils.getTimeFromString(commandData.date) : false
        const isArrive = $scope.selectedDateType.value === DATE_TYPES.ARRIVE

        utils.each(COMMAND_TYPES, function (commandType) {
            utils.each(travelTimeArmy, function (army, unit) {
                const travelTime = utils.getTravelTime(commandData.origin, commandData.target, army, commandType, commandData.officers, true)
                
                $scope.travelTimes[commandType][unit].travelTime = $filter('readableMillisecondsFilter')(travelTime)
                $scope.travelTimes[commandType][unit].status = commandTime ? sendTimeStatus(isArrive ? commandTime - travelTime : commandTime) : 'neutral'
            })
        })
    }

    /**
     * @param  {Number}  time - Command date input in milliseconds.
     * @return {Boolean}
     */
    const sendTimeStatus = function (time) {
        if (!time || !$scope.isValidDate) {
            return 'neutral'
        }

        return ($timeHelper.gameTime() + timeOffset) < time  ? 'valid' : 'invalid'
    }

    const updateDateType = function () {
        commandData.dateType = $scope.selectedDateType.value
        Lockr.set(STORAGE_KEYS.LAST_DATE_TYPE, $scope.selectedDateType.value)
        updateTravelTimes()
    }

    const updateCatapultTarget = function () {
        commandData.catapultTarget = $scope.catapultTarget.value
    }

    const insertPreset = function () {
        const selectedPreset = $scope.selectedInsertPreset.value

        if (!selectedPreset) {
            return false
        }

        const presets = modelDataService.getPresetList().getPresets()
        const preset = presets[selectedPreset]

        // reset displayed value
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, 'command_queue'),
            value: null
        }

        commandData.units = angular.copy(preset.units)
        commandData.officers = angular.copy(preset.officers)

        if (preset.catapult_target) {
            commandData.catapultTarget = preset.catapult_target
            $scope.catapultTarget = {
                name: $filter('i18n')(preset.catapult_target, $rootScope.loc.ale, 'building_names'),
                value: preset.catapult_target
            }
            $scope.showCatapultSelect = true

        }
    }

    const setupCountdownForCommand = function(command) {
        if(!command.updateCountdown) {
            command.updateCountdown = function() {
                const gameClockTime = $timeHelper.serverTime() + $rootScope.GAME_TIME_OFFSET // this yields the current time displayed by the game clock
                const displaySendTime = command.sendTime - (new Date()).getTimezoneOffset()*60*1000 // at time of writing, the command.sendTime is buggy - it's off by GMT offset plus GAME_TIME_OFFSET. This corrects that for display.

                command.countdown = displaySendTime - gameClockTime
            }
        }
        $timeHelper.timer.add(command.updateCountdown)
    }

    const updateWaitingCommands = function () {
        $scope.waitingCommands = commandQueue.getWaitingCommands()
    }

    const updateSentCommands = function () {
        $scope.sentCommands = commandQueue.getSentCommands()
    }

    const updateExpiredCommands = function () {
        $scope.expiredCommands = commandQueue.getExpiredCommands()
    }

    const updateVisibleCommands = function () {
        let commands = $scope.waitingCommands

        FILTER_ORDER.forEach(function (filter) {
            if ($scope.activeFilters[filter]) {
                commands = commandQueue.filterCommands(filter, $scope.filtersData, commands)
            }
        })

        $scope.visibleWaitingCommands = commands
    }

    const onUnitInputFocus = function (unit) {
        if (commandData.units[unit] === 0) {
            commandData.units[unit] = ''
        }
    }

    const onUnitInputBlur = function (unit) {
        if (commandData.units[unit] === '') {
            commandData.units[unit] = 0
        }
    }

    const catapultTargetVisibility = function () {
        $scope.showCatapultSelect = !!commandData.units.catapult
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const addSelected = function () {
        const village = modelDataService.getSelectedVillage().data
        
        commandData.origin = {
            id: village.villageId,
            x: village.x,
            y: village.y,
            name: village.name,
            character_id: $player.getId()
        }
    }

    const addMapSelected = function () {
        if (!mapSelectedVillage) {
            return utils.notif('error', $filter('i18n')('error_no_map_selected_village', $rootScope.loc.ale, 'command_queue'))
        }

        mapData.loadTownDataAsync(mapSelectedVillage.x, mapSelectedVillage.y, 1, 1, function (data) {
            commandData.target = data
        })
    }

    const addCurrentDate = function () {
        commandData.date = formatedDate()
    }

    const incrementDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, 100)
    }

    const reduceDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, -100)
    }

    const cleanUnitInputs = function () {
        commandData.units = angular.copy(unitList)
        commandData.officers = angular.copy(officerList)
        commandData.catapultTarget = DEFAULT_CATAPULT_TARGET
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
    }

    const addCommand = function (commandType) {
        commandQueue.addCommand(
            commandData.origin,
            commandData.target,
            commandData.date,
            commandData.dateType,
            commandData.units,
            commandData.officers,
            commandType,
            commandData.catapultTarget
        ).then(function (command) {
            updateWaitingCommands()
            updateVisibleCommands()
            setupCountdownForCommand(command)

            utils.notif('success', genNotifText(command.type, 'added'))
        }).catch(function (error) {
            switch (error) {
                case ERROR_CODES.INVALID_ORIGIN: {
                    utils.notif('error', $filter('i18n')('error_origin', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.INVALID_TARGET: {
                    utils.notif('error', $filter('i18n')('error_target', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.INVALID_DATE: {
                    utils.notif('error', $filter('i18n')('error_invalid_date', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.NO_UNITS: {
                    utils.notif('error', $filter('i18n')('error_no_units', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.RELOCATE_DISABLED: {
                    utils.notif('error', $filter('i18n')('error_relocate_disabled', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.ALREADY_SENT: {
                    utils.notif('error', $filter('i18n')('error_already_sent_' + commandType, $rootScope.loc.ale, 'command_queue'))
                    break
                }
            }
        })
    }

    const clearRegisters = function () {
        commandQueue.clearRegisters()
        updateSentCommands()
        updateExpiredCommands()
    }

    const switchCommandQueue = function () {
        if (commandQueue.isRunning()) {
            commandQueue.stop()
        } else {
            commandQueue.start()
        }
    }

    /**
     * Gera um texto de notificação com as traduções.
     *
     * @param  {String} key
     * @param  {String} key2
     * @param  {String=} prefix
     * @return {String}
     */
    const genNotifText = function (key, key2, prefix) {
        if (prefix) {
            key = prefix + '.' + key
        }

        const a = $filter('i18n')(key, $rootScope.loc.ale, 'command_queue')
        const b = $filter('i18n')(key2, $rootScope.loc.ale, 'command_queue')

        return a + ' ' + b
    }

    const toggleFilter = function (filter, allowedTypes) {
        $scope.activeFilters[filter] = !$scope.activeFilters[filter]

        if (allowedTypes) {
            $scope.filtersData[FILTER_TYPES.ALLOWED_TYPES][filter] = !$scope.filtersData[FILTER_TYPES.ALLOWED_TYPES][filter]
        }

        updateVisibleCommands()
    }

    const textMatchFilter = function () {
        $scope.activeFilters[FILTER_TYPES.TEXT_MATCH] = $scope.filtersData[FILTER_TYPES.TEXT_MATCH].length > 0
        updateVisibleCommands()
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        },
        autoCompleteSelected: function (event, id, data, type) {
            if (id !== 'commandqueue_village_search') {
                return false
            }

            commandData[type] = {
                id: data.raw.id,
                x: data.raw.x,
                y: data.raw.y,
                name: data.raw.name
            }

            $scope.searchQuery[type] = ''
        },
        removeCommand: function (event, command) {
            if(!$timeHelper.timer.remove(command.updateCountdown)) utils.notif('error', 'Error stopping command countdown. Command still removed.')
            updateWaitingCommands()
            updateVisibleCommands()
            $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            utils.notif('success', genNotifText(command.type, 'removed'))
        },
        removeError: function () {
            utils.notif('error', $filter('i18n')('error_remove_error', $rootScope.loc.ale, 'command_queue'))
        },
        sendTimeLimit: function (event, command) {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('error', genNotifText(command.type, 'expired'))
        },
        sendNotOwnVillage: function () {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('error', $filter('i18n')('error_not_own_village', $rootScope.loc.ale, 'command_queue'))
        },
        sendNoUnitsEnough: function () {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('error', $filter('i18n')('error_no_units_enough', $rootScope.loc.ale, 'command_queue'))
        },
        sendCommand: function (event, command) {
            if(!$timeHelper.timer.remove(command.updateCountdown)) utils.notif('error', 'Error stopping command countdown. Command still sent.')
            updateSentCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('success', genNotifText(command.type, 'sent'))
        },
        start: function (event, data) {
            $scope.running = commandQueue.isRunning()

            if (data.disableNotif) {
                return false
            }

            utils.notif('success', genNotifText('title', 'activated'))
        },
        stop: function () {
            $scope.running = commandQueue.isRunning()
            utils.notif('success', genNotifText('title', 'deactivated'))
        },
        onAutoCompleteOrigin: function (data) {
            commandData.origin = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        },
        onAutoCompleteTarget: function (data) {
            commandData.target = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        },
        clearCountdownUpdates: function () {
            commandQueue.getWaitingCommands().forEach((command) => {
                $timeHelper.timer.remove(command.updateCountdown)
            })
        }
    }

    const init = function () {
        $player = modelDataService.getSelectedCharacter()
        timeOffset = utils.getTimeOffset()
        const attackableBuildingsMap = $gameData.getAttackableBuildings()

        for (let building in attackableBuildingsMap) {
            attackableBuildingsList.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        unitOrder = angular.copy(orderedUnitNames)
        unitOrder.splice(unitOrder.indexOf('catapult'), 1)

        orderedUnitNames.forEach(function (unit) {
            unitList[unit] = 0
        })

        orderedOfficerNames.forEach(function (unit) {
            officerList[unit] = false
        })

        commandData = {
            origin: false,
            target: false,
            date: '',
            dateType: DATE_TYPES.OUT,
            units: angular.copy(unitList),
            officers: angular.copy(officerList),
            catapultTarget: DEFAULT_CATAPULT_TARGET,
            type: null
        }
        activeFilters = {
            [FILTER_TYPES.SELECTED_VILLAGE]: false,
            [FILTER_TYPES.BARBARIAN_TARGET]: false,
            [FILTER_TYPES.ALLOWED_TYPES]: true,
            [FILTER_TYPES.ATTACK]: true,
            [FILTER_TYPES.SUPPORT]: true,
            [FILTER_TYPES.RELOCATE]: true,
            [FILTER_TYPES.TEXT_MATCH]: false
        }
        filtersData = {
            [FILTER_TYPES.ALLOWED_TYPES]: {
                [FILTER_TYPES.ATTACK]: true,
                [FILTER_TYPES.SUPPORT]: true,
                [FILTER_TYPES.RELOCATE]: true,
            },
            [FILTER_TYPES.TEXT_MATCH]: ''
        }

        $button = interfaceOverflow.addMenuButton('Generał', 20)
        $button.addEventListener('click', buildWindow)

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_START, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_STOP, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        $rootScope.$on(eventTypeProvider.SHOW_CONTEXT_MENU, setMapSelectedVillage)
        $rootScope.$on(eventTypeProvider.DESTROY_CONTEXT_MENU, unsetMapSelectedVillage)

        interfaceOverflow.addTemplate('twoverflow_queue_window', `<div id=\"two-command-queue\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Generał</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.ADD)\" ng-class=\"{true:'tab-active', false:''}[selectedTab == TAB_TYPES.ADD]\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.ADD}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.ADD}\">{{ 'tab_add' | i18n:loc.ale:'command_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.WAITING)\" ng-class=\"{true:'tab-active', false:''}[selectedTab == TAB_TYPES.WAITING]\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.WAITING}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.WAITING}\">{{ 'tab_waiting' | i18n:loc.ale:'command_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{true:'tab-active', false:''}[selectedTab == TAB_TYPES.LOGS]\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ 'tab_logs' | i18n:loc.ale:'command_queue' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"add\" ng-show=\"selectedTab === TAB_TYPES.ADD\"><form class=\"addForm\"><div><table class=\"tbl-border-light tbl-striped basic-config\"><col width=\"30%\"><col width=\"5%\"><col><col width=\"18%\"><tr><td><div auto-complete=\"autoCompleteOrigin\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'command_queue' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_selected' | i18n:loc.ale:'command_queue' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.target\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'command_queue' }}<td ng-if=\"commandData.target\" class=\"command-village\">{{ commandData.target.name }} ({{ commandData.target.x }}|{{ commandData.target.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'command_queue' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><input ng-model=\"commandData.date\" class=\"textfield-border date\" pattern=\"\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*\" placeholder=\"{{ 'add_date' | i18n:loc.ale:'command_queue' }}\" tooltip=\"\" tooltip-content=\"hh:mm:ss:SSS dd/MM/yyyy\"><td class=\"text-center\"><span class=\"icon-26x26-time\"></span><td><div select=\"\" list=\"dateTypes\" selected=\"selectedDateType\" drop-down=\"true\"></div><td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"reduceDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_minus' | i18n:loc.ale:'command_queue' }}\">-</a><a class=\"btn btn-orange\" ng-click=\"addCurrentDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date' | i18n:loc.ale:'command_queue' }}\">{{ 'now' | i18n:loc.ale:'common' }}</a><a class=\"btn btn-orange\" ng-click=\"incrementDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_plus' | i18n:loc.ale:'command_queue' }}\">+</a></table><table ng-show=\"commandData.origin && commandData.target\" class=\"tbl-border-light tbl-units tbl-speed screen-village-info\"><thead><tr><th colspan=\"7\">{{ 'speed_title' | i18n:loc.ale:'screen_village_info' }}<tbody><tr><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-34x34-unit-knight\"></span> <span class=\"icon icon-34x34-unit-light_cavalry\"></span> <span class=\"icon icon-34x34-unit-mounted_archer\"></span></div><div><div class=\"box-time-sub-icon time-attack {{ travelTimes.attack.light_cavalry.status }}\"><div class=\"time-icon icon-20x20-attack-check\" tooltip=\"\" tooltip-content=\"{{ 'travel_time_attack' | i18n:loc.ale:'military_operations' }}\"></div>{{ travelTimes.attack.light_cavalry.travelTime }}</div><div class=\"box-time-sub-icon time-support {{ travelTimes.support.light_cavalry.status }}\"><div class=\"time-icon icon-20x20-support-check\" tooltip=\"\" tooltip-content=\"{{ 'travel_time_support' | i18n:loc.ale:'military_operations' }}\"></div>{{ travelTimes.support.light_cavalry.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub-icon time-relocate {{ travelTimes.relocate.light_cavalry.status }}\"><div class=\"time-icon icon-20x20-relocate\" tooltip=\"\" tooltip-content=\"{{ 'travel_time_relocate' | i18n:loc.ale:'military_operations' }}\"></div>{{ travelTimes.relocate.light_cavalry.travelTime }}</div></div><td><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-heavy_cavalry\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.heavy_cavalry.status }}\">{{ travelTimes.attack.heavy_cavalry.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.heavy_cavalry.status }}\">{{ travelTimes.support.heavy_cavalry.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.heavy_cavalry.status }}\">{{ travelTimes.relocate.heavy_cavalry.travelTime }}</div></div><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-34x34-unit-archer\"></span> <span class=\"icon icon-34x34-unit-spear\"></span> <span class=\"icon icon-34x34-unit-axe\"></span> <span class=\"icon icon-34x34-unit-doppelsoldner\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.archer.status }}\">{{ travelTimes.attack.archer.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.archer.status }}\">{{ travelTimes.support.archer.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.archer.status }}\">{{ travelTimes.relocate.archer.travelTime }}</div></div><td><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-sword\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.sword.status }}\">{{ travelTimes.attack.sword.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.sword.status }}\">{{ travelTimes.support.sword.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.sword.status }}\">{{ travelTimes.relocate.sword.travelTime }}</div></div><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-34x34-unit-catapult\"></span> <span class=\"icon icon-34x34-unit-ram\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.ram.status }}\">{{ travelTimes.attack.ram.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.ram.status }}\">{{ travelTimes.support.ram.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.ram.status }}\">{{ travelTimes.relocate.ram.travelTime }}</div></div><td><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-snob\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.snob.status }}\">{{ travelTimes.attack.snob.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.snob.status }}\">{{ travelTimes.support.snob.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.snob.status }}\">-</div></div><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-trebuchet\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.trebuchet.status }}\">{{ travelTimes.attack.trebuchet.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.trebuchet.status }}\">{{ travelTimes.support.trebuchet.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.trebuchet.status }}\">{{ travelTimes.relocate.trebuchet.travelTime }}</div></div></table></div><h5 class=\"twx-section\">{{ 'units' | i18n:loc.ale:'common' }}</h5><table class=\"tbl-border-light tbl-striped\"><col width=\"25%\"><col width=\"25%\"><col width=\"25%\"><col width=\"25%\"><tbody class=\"add-units\"><tr><td colspan=\"4\" class=\"actions\"><ul class=\"list-btn list-center\"><li><div select=\"\" list=\"presets\" selected=\"selectedInsertPreset\" drop-down=\"true\"></div><li><a class=\"clear-units btn btn-orange\" ng-click=\"cleanUnitInputs()\">{{ 'add_clear' | i18n:loc.ale:'command_queue' }}</a></ul><tr ng-repeat=\"i in [] | range:(unitOrder.length / 4);\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4])\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4 + 1]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4 + 1] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4 + 1]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4 + 1]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4 + 1])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4 + 1])\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4 + 2]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4 + 2] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4 + 2]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4 + 2]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4 + 2])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4 + 2])\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4 + 3]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4 + 3] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4 + 3]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4 + 3]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4 + 3])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4 + 3])\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-catapult\" tooltip=\"\" tooltip-content=\"{{ 'catapult' | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units.catapult\" maxlength=\"5\" placeholder=\"{{ commandData.units.catapult }}\" ng-keyup=\"catapultTargetVisibility()\" ng-focus=\"onUnitInputFocus('catapult')\" ng-blur=\"onUnitInputBlur('catapult')\"><td colspan=\"3\"><div ng-visible=\"showCatapultSelect\"><div class=\"unit-border box-slider\"><div class=\"height-wrapper\"><div select=\"\" list=\"attackableBuildings\" selected=\"catapultTarget\"></div></div></div></div></table><h5 class=\"twx-section\">{{ 'officers' | i18n:loc.ale:'common' }}</h5><table class=\"add-officers margin-top tbl-border-light tbl-officers\"><tr><td class=\"cell-officers\" ng-repeat=\"officer in officers\"><table class=\"tbl-border-dark tbl-officer\"><tr><td class=\"cell-space\"><span class=\"icon-44x44-premium_officer_{{ officer }}\"></span><td class=\"cell-officer-switch\" rowspan=\"2\"><div switch-slider=\"\" enabled=\"true\" value=\"commandData.officers[officer]\" vertical=\"true\" size=\"'34x66'\"></div><tr><td tooltip=\"\" tooltip-content=\"{{ 'available_officers' | i18n:loc.ale:'modal_preset_edit' }}\"><div class=\"amount\">{{ inventory.getItemAmountByType('premium_officer_' + officer) | number }}</div></table></table></form></div><div class=\"waiting rich-text\" ng-show=\"selectedTab === TAB_TYPES.WAITING\"><div class=\"filters\"><table class=\"tbl-border-light\"><tr><td><div ng-class=\"{'active': activeFilters[FILTER_TYPES.SELECTED_VILLAGE]}\" ng-click=\"toggleFilter(FILTER_TYPES.SELECTED_VILLAGE)\" class=\"box-border-dark icon selectedVillage\" tooltip=\"\" tooltip-content=\"{{ 'filters_selected_village' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-village-info icon-bg-black\"></span></div><div ng-class=\"{'active': activeFilters[FILTER_TYPES.BARBARIAN_TARGET]}\" ng-click=\"toggleFilter(FILTER_TYPES.BARBARIAN_TARGET)\" class=\"box-border-dark icon barbarianTarget\" tooltip=\"\" tooltip-content=\"{{ 'filters_barbarian_target' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-barbarian-village icon-bg-black\"></span></div><div ng-class=\"{'active': activeFilters[FILTER_TYPES.ATTACK]}\" ng-click=\"toggleFilter(FILTER_TYPES.ATTACK, true)\" class=\"box-border-dark icon allowedTypes\" tooltip=\"\" tooltip-content=\"{{ 'filters_attack' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-attack icon-bg-black\"></span></div><div ng-class=\"{'active': activeFilters[FILTER_TYPES.SUPPORT]}\" ng-click=\"toggleFilter(FILTER_TYPES.SUPPORT, true)\" class=\"box-border-dark icon allowedTypes\" tooltip=\"\" tooltip-content=\"{{ 'filters_support' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-support icon-bg-black\"></span></div><div ng-if=\"relocateEnabled\" ng-class=\"{'active': activeFilters[FILTER_TYPES.RELOCATE]}\" ng-click=\"toggleFilter(FILTER_TYPES.RELOCATE, true)\" class=\"box-border-dark icon allowedTypes\" tooltip=\"\" tooltip-content=\"{{ 'filters_relocate' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-relocate icon-bg-black\"></span></div><div class=\"text\"><input ng-model=\"filtersData[FILTER_TYPES.TEXT_MATCH]\" class=\"box-border-dark\" placeholder=\"{{ 'filters_text_match' | i18n:loc.ale:'command_queue' }}\"></div></table></div><div class=\"queue\"><h5 class=\"twx-section\">{{ 'queue_waiting' | i18n:loc.ale:'command_queue' }}</h5><p class=\"text-center\" ng-show=\"!visibleWaitingCommands.length\">{{ 'queue_none_added' | i18n:loc.ale:'command_queue' }}<table class=\"tbl-border-light\" ng-repeat=\"command in visibleWaitingCommands\"><col width=\"100px\"><tr><th colspan=\"2\"><span ng-class=\"{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === COMMAND_TYPES.ATTACK]\" class=\"icon-26x26-{{ command.type }}\" tooltip=\"\" tooltip-content=\"{{ command.type | i18n:loc.ale:'common' }}\"></span> <span class=\"size-26x26 icon-bg-black icon-26x26-time-duration\" tooltip=\"\" tooltip-content=\"{{ 'command_time_left' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"time-left\">{{ command.countdown | readableMillisecondsFilter }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'command_out' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"sent-time\">{{ command.sendTime | readableDateFilter:loc.ale }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-time-arrival\" tooltip=\"\" tooltip-content=\"{{ 'command_arrive' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"arrive-time\">{{ command.arriveTime | readableDateFilter:loc.ale }}</span> <a href=\"#\" class=\"remove-command size-20x20 btn-red icon-20x20-close\" ng-click=\"removeCommand(command, EVENT_CODES.COMMAND_REMOVED)\" tooltip=\"\" tooltip-content=\"{{ 'queue_remove' | i18n:loc.ale:'command_queue' }}\"></a><tr><td>{{ 'villages' | i18n:loc.ale:'common' }}<td><a class=\"origin\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.origin.id)\">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class=\"size-20x20 icon-26x26-{{ command.type }}\"></span> <a class=\"target\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.target.id)\">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a><tr><td>{{ 'units' | i18n:loc.ale:'common' }}<td class=\"units\"><div class=\"unit\" ng-repeat=\"(unit, amount) in command.units\"><span class=\"icon-34x34-unit-{{ unit }} icon\"></span> <span class=\"amount\">{{ amount }}</span> <span ng-if=\"unit === 'catapult' && command.type === COMMAND_TYPES.ATTACK\">({{ command.catapultTarget | i18n:loc.ale:'building_names' }})</span></div><div class=\"officer\" ng-repeat=\"(officer, enabled) in command.officers\"><span class=\"icon-34x34-premium_officer_{{ officer }}\"></span></div></table></div></div><div class=\"logs rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><h5 class=\"twx-section\">{{ 'queue_sent' | i18n:loc.ale:'command_queue' }}</h5><p class=\"text-center\" ng-show=\"!sentCommands.length\">{{ 'queue_none_sent' | i18n:loc.ale:'command_queue' }}<table class=\"tbl-border-light\" ng-repeat=\"command in sentCommands track by $index\"><col width=\"100px\"><tr><th colspan=\"2\"><span ng-class=\"{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === COMMAND_TYPES.ATTACK]\" class=\"icon-26x26-{{ command.type }}\" tooltip=\"\" tooltip-content=\"{{ command.type | i18n:loc.ale:'common' }}\"></span> <span class=\"size-26x26 icon-bg-black icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'command_out' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"sent-time\">{{ command.sendTime | readableDateFilter:loc.ale }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-time-arrival\" tooltip=\"\" tooltip-content=\"{{ 'command_arrive' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"arrive-time\">{{ command.arriveTime | readableDateFilter:loc.ale }}</span><tr><td>{{ 'villages' | i18n:loc.ale:'common' }}<td><a class=\"origin\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.origin.id)\">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class=\"size-20x20 icon-26x26-{{ command.type }}\"></span> <a class=\"target\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.target.id)\">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a><tr><td>{{ 'units' | i18n:loc.ale:'common' }}<td class=\"units\"><div class=\"unit\" ng-repeat=\"(unit, amount) in command.units\"><span class=\"icon-34x34-unit-{{ unit }} icon\"></span> <span class=\"amount\">{{ amount }}</span> <span ng-if=\"unit === 'catapult' && command.type === COMMAND_TYPES.ATTACK\">({{ command.catapultTarget | i18n:loc.ale:'common' }})</span></div><div class=\"officer\" ng-repeat=\"(officer, enabled) in command.officers\"><span class=\"icon-34x34-premium_officer_{{ officer }}\"></span></div></table><h5 class=\"twx-section\">{{ 'queue_expired' | i18n:loc.ale:'command_queue' }}</h5><p class=\"text-center\" ng-show=\"!expiredCommands.length\">{{ 'queue_none_expired' | i18n:loc.ale:'command_queue' }}<table class=\"tbl-border-light\" ng-repeat=\"command in expiredCommands track by $index\"><col width=\"100px\"><tr><th colspan=\"2\"><span ng-class=\"{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === COMMAND_TYPES.ATTACK]\" class=\"icon-26x26-{{ command.type }}\" tooltip=\"\" tooltip-content=\"{{ command.type | i18n:loc.ale:'common' }}\"></span> <span class=\"size-26x26 icon-bg-black icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'command_out' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"sent-time\">{{ command.sendTime | readableDateFilter:loc.ale }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-time-arrival\" tooltip=\"\" tooltip-content=\"{{ 'command_arrive' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"arrive-time\">{{ command.arriveTime | readableDateFilter:loc.ale }}</span><tr><td>{{ 'villages' | i18n:loc.ale:'common' }}<td><a class=\"origin\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.origin.id)\">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class=\"size-20x20 icon-26x26-{{ command.type }}\"></span> <a class=\"target\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.target.id)\">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a><tr><td>{{ 'units' | i18n:loc.ale:'common' }}<td class=\"units\"><div class=\"unit\" ng-repeat=\"(unit, amount) in command.units\"><span class=\"icon-34x34-unit-{{ unit }} icon\"></span> <span class=\"amount\">{{ amount }}</span> <span ng-if=\"unit === 'catapult' && command.type === COMMAND_TYPES.ATTACK\">({{ command.catapultTarget | i18n:loc.ale:'common' }})</span></div><div class=\"officer\" ng-repeat=\"(officer, enabled) in command.officers\"><span class=\"icon-34x34-premium_officer_{{ officer }}\"></span></div></table></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a class=\"btn-orange btn-border\" ng-click=\"clearRegisters()\">{{ 'general_clear' | i18n:loc.ale:'command_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.ADD\"><a class=\"btn-orange btn-border add\" ng-click=\"addCommand(COMMAND_TYPES.ATTACK)\"><span class=\"icon-26x26-attack-small\"></span> {{ COMMAND_TYPES.ATTACK | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.ADD\"><a class=\"btn-orange btn-border add\" ng-click=\"addCommand(COMMAND_TYPES.SUPPORT)\"><span class=\"icon-26x26-support\"></span> {{ COMMAND_TYPES.SUPPORT | i18n:loc.ale:'common' }}</a><li ng-show=\"relocateEnabled && selectedTab === TAB_TYPES.ADD\"><a class=\"btn-orange btn-border add\" ng-click=\"addCommand(COMMAND_TYPES.RELOCATE)\"><span class=\"icon-26x26-relocate\"></span> {{ COMMAND_TYPES.RELOCATE | i18n:loc.ale:'common' }}</a><li><a href=\"#\" ng-class=\"{false:'btn-green', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchCommandQueue()\"><span ng-show=\"running\">{{ 'deactivate' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'activate' | i18n:loc.ale:'common' }}</span></a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-command-queue input.unit{width:80px;height:34px}#two-command-queue form .padded{padding:2px 8px}#two-command-queue .basic-config input{width:200px;height:28px;font-weight:bold;padding:1px 8px 0 8px;outline:none;border:none;color:#000;resize:none}#two-command-queue span.select-wrapper{height:27px}#two-command-queue span.select-wrapper a.select-button{height:23px}#two-command-queue span.select-wrapper a.select-handler{-webkit-box-shadow:none;box-shadow:none;height:23px;line-height:23px;margin-bottom:-1px}#two-command-queue .custom-select{width:240px}#two-command-queue .originVillage,#two-command-queue .targetVillage{padding:0 7px}#two-command-queue a.btn{height:28px;line-height:28px;padding:0 10px}#two-command-queue .actions{text-align:center;user-select:none}#two-command-queue .command-village{padding-left:5px;padding-right:5px}#two-command-queue .add-units td{padding:2px 0;text-align:center}#two-command-queue .add-units .unit-icon{top:-1px}#two-command-queue .add-units span[class*="icon-34x34"]{margin-top:-2px !important}#two-command-queue .add-units input{height:34px;color:#fff3d0;border:none;outline:none;font-size:14px;background:url(data:image/png;base64,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) top left #b89064;box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px #a2682c,inset 0 0 0 3px #000,inset -3px -3px 2px 0 #fff,inset 0 0 9px 5px rgba(99,54,0,0.5);text-align:center;width:80px}#two-command-queue .add-officers .cell-officers{padding:7px 11px 5px 11px}#two-command-queue .add-officers .amount{color:#fff;text-align:center}#two-command-queue .command{margin-bottom:10px}#two-command-queue .command .time-left{width:93px;display:inline-block;padding:0 0 0 3px}#two-command-queue .command .sent-time,#two-command-queue .command .arrive-time{width:160px;display:inline-block;padding:0 0 0 5px}#two-command-queue .command td{padding:3px 6px}#two-command-queue .officers td{width:111px;text-align:center}#two-command-queue .officers label{margin-left:5px}#two-command-queue .officers span{margin-left:2px}#two-command-queue .units div.unit{float:left}#two-command-queue .units div.unit span.icon{transform:scale(.7);width:25px;height:25px}#two-command-queue .units div.unit span.amount{vertical-align:-2px;margin:0 5px 0 2px}#two-command-queue .units div.officer{float:left;margin:0 2px}#two-command-queue .units div.officer span{transform:scale(.7);width:25px;height:25px}#two-command-queue .remove-command{float:right;margin-top:3px}#two-command-queue .tbl-units td{text-align:center}#two-command-queue .tbl-speed{margin-top:10px}#two-command-queue .tbl-speed th{text-align:center}#two-command-queue .tbl-speed td{font-size:12px}#two-command-queue .tbl-speed .box-time-sub-icon{position:relative}#two-command-queue .tbl-speed .box-time-sub-icon .time-icon{position:absolute;top:-3px;left:27px;transform:scale(.7)}#two-command-queue .tbl-speed .box-time-sub-icon.time-relocate .time-icon{top:-6px;left:26px}#two-command-queue .tbl-speed .valid{color:#16600a}#two-command-queue .tbl-speed .invalid{color:#a1251f}#two-command-queue .tbl-speed .neutral{color:#000}#two-command-queue .dateType{width:200px}#two-command-queue .dateType .custom-select-handler{text-align:left}#two-command-queue .filters .icon{width:38px;float:left;margin:0 6px}#two-command-queue .filters .icon.active:before{box-shadow:0 0 0 1px #000,-1px -1px 0 2px #ac9c44,0 0 0 3px #ac9c44,0 0 0 4px #000;border-radius:1px;content:"";position:absolute;width:38px;height:38px;left:-1px;top:-1px}#two-command-queue .filters .text{margin-left:262px}#two-command-queue .filters .text input{height:36px;margin-top:1px;width:100%;text-align:left;padding:0 5px}#two-command-queue .filters .text input::placeholder{color:white}#two-command-queue .filters .text input:focus::placeholder{color:transparent}#two-command-queue .filters td{padding:6px}#two-command-queue .icon-34x34-barbarian-village:before{filter:grayscale(100%);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-220px -906px}#two-command-queue .icon-20x20-time-arrival:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-529px -454px}#two-command-queue .icon-20x20-attack:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-546px -1086px;width:26px;height:26px}#two-command-queue .icon-20x20-support:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-462px -360px;width:26px;height:26px}#two-command-queue .icon-20x20-relocate:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-1090px -130px;width:26px;height:26px}#two-command-queue .icon-26x26-attack:before{background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-546px -1086px}')
    }

    const buildWindow = function () {
        const lastDateType = Lockr.get(STORAGE_KEYS.LAST_DATE_TYPE, DATE_TYPES.OUT, true)

        $scope = $rootScope.$new()
        $scope.selectedTab = DEFAULT_TAB
        $scope.inventory = modelDataService.getInventory()
        $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        $scope.travelTimes = {}

        utils.each(COMMAND_TYPES, function (commandType) {
            $scope.travelTimes[commandType] = {}

            utils.each(travelTimeArmy, function (army, unit) {
                $scope.travelTimes[commandType][unit] = { travelTime: 0, status: 'neutral' }
            })
        })

        $scope.unitOrder = unitOrder
        $scope.officers = $gameData.getOrderedOfficerNames()
        $scope.searchQuery = {
            origin: '',
            target: ''
        }
        $scope.isValidDate = false
        $scope.dateTypes = util.toActionList(DATE_TYPES, function (actionType) {
            return $filter('i18n')(actionType, $rootScope.loc.ale, 'command_queue')
        })
        $scope.selectedDateType = {
            name: $filter('i18n')(lastDateType, $rootScope.loc.ale, 'command_queue'),
            value: lastDateType
        }
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, 'command_queue'),
            value: null
        }
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.autoCompleteOrigin = {
            type: ['village'],
            placeholder: $filter('i18n')('add_village_search', $rootScope.loc.ale, 'command_queue'),
            onEnter: eventHandlers.onAutoCompleteOrigin,
            tooltip: $filter('i18n')('add_origin', $rootScope.loc.ale, 'command_queue'),
            dropDown: true
        }
        $scope.autoCompleteTarget = {
            type: ['village'],
            placeholder: $filter('i18n')('add_village_search', $rootScope.loc.ale, 'command_queue'),
            onEnter: eventHandlers.onAutoCompleteTarget,
            tooltip: $filter('i18n')('add_target', $rootScope.loc.ale, 'command_queue'),
            dropDown: true
        }
        $scope.showCatapultSelect = !!commandData.units.catapult
        $scope.attackableBuildings = attackableBuildingsList
        $scope.commandData = commandData
        $scope.activeFilters = activeFilters
        $scope.filtersData = filtersData
        $scope.running = commandQueue.isRunning()
        $scope.waitingCommands = commandQueue.getWaitingCommands()
        $scope.visibleWaitingCommands = commandQueue.getWaitingCommands()
        $scope.sentCommands = commandQueue.getSentCommands()
        $scope.expiredCommands = commandQueue.getExpiredCommands()
        $scope.EVENT_CODES = EVENT_CODES
        $scope.FILTER_TYPES = FILTER_TYPES
        $scope.TAB_TYPES = TAB_TYPES
        $scope.COMMAND_TYPES = COMMAND_TYPES
        $scope.relocateEnabled = modelDataService.getWorldConfig().isRelocateUnitsEnabled()

        // functions
        $scope.onUnitInputFocus = onUnitInputFocus
        $scope.onUnitInputBlur = onUnitInputBlur
        $scope.catapultTargetVisibility = catapultTargetVisibility
        $scope.selectTab = selectTab
        $scope.addSelected = addSelected
        $scope.addMapSelected = addMapSelected
        $scope.addCurrentDate = addCurrentDate
        $scope.incrementDate = incrementDate
        $scope.reduceDate = reduceDate
        $scope.cleanUnitInputs = cleanUnitInputs
        $scope.addCommand = addCommand
        $scope.clearRegisters = clearRegisters
        $scope.switchCommandQueue = switchCommandQueue
        $scope.removeCommand = commandQueue.removeCommand
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.toggleFilter = toggleFilter

        $scope.$watch('commandData.origin', updateTravelTimes)
        $scope.$watch('commandData.target', updateTravelTimes)
        $scope.$watch('commandData.date', updateTravelTimes)
        $scope.$watch('commandData.officers', updateTravelTimes)
        $scope.$watch('selectedDateType.value', updateDateType)
        $scope.$watch('selectedInsertPreset.value', insertPreset)
        $scope.$watch('catapultTarget.value', updateCatapultTarget)
        $scope.$watch('filtersData[FILTER_TYPES.TEXT_MATCH]', textMatchFilter)

        let travelTimesTimer

        $scope.$watch('selectedTab', function () {
            if ($scope.selectedTab === TAB_TYPES.ADD) {
                travelTimesTimer = setInterval(function () {
                    updateTravelTimes()
                }, 2500)
            } else {
                clearInterval(travelTimesTimer)
            }
        })
        
        $scope.waitingCommands.forEach((command) => {
            setupCountdownForCommand(command)
        })

        let eventScope = new EventScope('twoverflow_queue_window', function () {
            clearInterval(travelTimesTimer)
            eventHandlers.clearCountdownUpdates()
        })

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.SELECT_SELECTED, eventHandlers.autoCompleteSelected, true)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE, eventHandlers.removeCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, eventHandlers.removeError)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, eventHandlers.sendTimeLimit)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, eventHandlers.sendNotOwnVillage)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, eventHandlers.sendNoUnitsEnough)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND, eventHandlers.sendCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_STOP, eventHandlers.stop)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    return init
})

define('two/commandQueue/storageKeys', [], function () {
    return {
        QUEUE_COMMANDS: 'command_queue_commands',
        QUEUE_SENT: 'command_queue_sent',
        QUEUE_EXPIRED: 'command_queue_expired',
        LAST_DATE_TYPE: 'command_queue_last_date_type'
    }
})

define('two/commandQueue/types/commands', [], function () {
    return {
        'ATTACK': 'attack',
        'SUPPORT': 'support',
        'RELOCATE': 'relocate'
    }
})

define('two/commandQueue/types/dates', [], function () {
    return {
        ARRIVE: 'date_type_arrive',
        OUT: 'date_type_out'
    }
})

define('two/commandQueue/types/events', [], function () {
    return {
        NOT_OWN_VILLAGE: 'not_own_village',
        NOT_ENOUGH_UNITS: 'not_enough_units',
        TIME_LIMIT: 'time_limit',
        COMMAND_REMOVED: 'command_removed',
        COMMAND_SENT: 'command_sent'
    }
})

define('two/commandQueue/types/filters', [], function () {
    return {
        SELECTED_VILLAGE: 'selected_village',
        BARBARIAN_TARGET: 'barbarian_target',
        ALLOWED_TYPES: 'allowed_types',
        ATTACK: 'attack',
        SUPPORT: 'support',
        RELOCATE: 'relocate',
        TEXT_MATCH: 'text_match'
    }
})

define('two/commandQueue/errorCodes', [], function () {
    return {
        INVALID_ORIGIN: 'invalid_origin',
        INVALID_TARGET: 'invalid_target',
        INVALID_DATE: 'invalid_date',
        NO_UNITS: 'no_units',
        ALREADY_SENT: 'already_sent',
        RELOCATE_DISABLED: 'relocate_disabled',
        INVALID_DATE_TYPE: 'invalid_date_type',
        INVALID_OFFICER: 'invalid_officer',
        INVALID_COMMAND_TYPE: 'invalid_command_type',
        INVALID_CATAPULT_TARGET: 'invalid_catapult_target',
        INVALID_UNIT_TYPE: 'invalid_unit_type',
        INVALID_OFFICER_TYPE: 'invalid_officer_type'
    }
})

require([
    'two/ready',
    'two/commandQueue',
    'two/commandQueue/ui',
    'two/commandQueue/events'
], function (
    ready,
    commandQueue,
    commandQueueInterface
) {
    if (commandQueue.initialized) {
        return false
    }

    ready(function () {
        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    }, ['map', 'world_config'])
})

define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/types/errors',
    'two/farmOverflow/types/status',
    'two/farmOverflow/settings',
    'two/farmOverflow/settings/map',
    'two/farmOverflow/settings/updates',
    'two/farmOverflow/types/logs',
    'two/mapData',
    'two/utils',
    'two/ready',
    'helper/math',
    'helper/time',
    'queues/EventQueue',
    'conf/commandTypes',
    'conf/village',
    'conf/resourceTypes',
    'struct/MapData',
    'Lockr'
], function (
    Settings,
    ERROR_TYPES,
    STATUS,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    LOG_TYPES,
    twoMapData,
    utils,
    ready,
    math,
    timeHelper,
    eventQueue,
    COMMAND_TYPES,
    VILLAGE_CONFIG,
    RESOURCE_TYPES,
    $mapData,
    Lockr
) {
    let initialized = false
    let running = false
    let settings
    let farmSettings
    let farmers = []
    let logs = []
    let includedVillages = []
    let ignoredVillages = []
    let onlyVillages = []
    let selectedPresets = []
    let activeFarmer = false
    let sendingCommand = false
    let currentTarget = false
    let farmerIndex = 0
    let cycleTimer = null
    let stepDelayTimer = null
    let commandExpireTimer = null
    let exceptionLogs
    let tempVillageReports = {}
    let $player
    let unitsData
    let persistentRunningLastCheck = timeHelper.gameTime()
    let persistentRunningTimer = null
    let nextCycleDate = null
    const PERSISTENT_RUNNING_CHECK_INTERVAL = 30 * 1000
    const VILLAGE_COMMAND_LIMIT = 50
    const MINIMUM_FARMER_CYCLE_INTERVAL = 1 // minutes
    const MINIMUM_ATTACK_INTERVAL = 0 // seconds
    const STEP_EXPIRE_TIME = 30 * 1000
    const CYCLE_BEGIN = 'cycle_begin'
    const IGNORE_UPDATES = 'ignore_update'
    const STORAGE_KEYS = {
        LOGS: 'farm_overflow_logs',
        SETTINGS: 'farm_overflow_settings',
        EXCEPTION_LOGS: 'farm_overflow_exception_logs'
    }
    const RESOURCES = [
        RESOURCE_TYPES.WOOD,
        RESOURCE_TYPES.CLAY,
        RESOURCE_TYPES.IRON,
    ]

    const villageFilters = {
        distance: function (target) {
            return !target.distance.between(
                farmSettings[SETTINGS.MIN_DISTANCE],
                farmSettings[SETTINGS.MAX_DISTANCE]
            )
        },
        ownPlayer: function (target) {
            return target.character_id === $player.getId()
        },
        included: function (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        ignored: function (target) {
            return ignoredVillages.includes(target.id)
        },
        points: function (points) {
            return !points.between(
                farmSettings[SETTINGS.MIN_POINTS],
                farmSettings[SETTINGS.MAX_POINTS]
            )
        }
    }

    const targetFilters = [
        villageFilters.distance,
        villageFilters.ownPlayer,
        villageFilters.included,
        villageFilters.ignored
    ]

    const calcDistances = function (targets, origin) {
        return targets.map(function (target) {
            target.distance = math.actualDistance(origin, target)
            return target
        })
    }

    const filterTargets = function (targets) {
        return targets.filter(function (target) {
            return targetFilters.every(function (fn) {
                return !fn(target)
            })
        })
    }

    const sortTargets = function (targets) {
        return targets.sort(function (a, b) {
            return a.distance - b.distance
        })
    }

    const arrayUnique = function (array) {
        return array.sort().filter(function (item, pos, ary) {
            return !pos || item != ary[pos - 1]
        })
    }

    const reloadTimers = function () {
        if (!running) {
            return
        }

        if (stepDelayTimer) {
            stopTimers()
            activeFarmer.targetStep({
                delay: true
            })
        } else if (cycleTimer) {
            stopTimers()

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)

            farmerIndex = 0
            farmerStep()
        }
    }

    const updateIncludedVillage = function () {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]

        includedVillages = []

        groupsInclude.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groupVillages)
        })

        includedVillages = arrayUnique(includedVillages)
    }

    const updateIgnoredVillage = function () {
        const groupIgnored = farmSettings[SETTINGS.GROUP_IGNORE]
        ignoredVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnored)
    }

    const updateOnlyVillage = function () {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]

        onlyVillages = []

        groupsOnly.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            groupVillages = groupVillages.filter(function (villageId) {
                return !!$player.getVillage(villageId)
            })

            onlyVillages = onlyVillages.concat(groupVillages)
        })

        onlyVillages = arrayUnique(onlyVillages)
    }

    const updateExceptionLogs = function () {
        const exceptionVillages = ignoredVillages.concat(includedVillages)
        let modified = false

        exceptionVillages.forEach(function (villageId) {
            if (!hasOwn.call(exceptionLogs, villageId)) { 
                exceptionLogs[villageId] = {
                    time: timeHelper.gameTime(),
                    report: false
                }
                modified = true
            }
        })

        utils.each(exceptionLogs, function (time, villageId) {
            villageId = parseInt(villageId, 10)
            
            if (!exceptionVillages.includes(villageId)) {
                delete exceptionLogs[villageId]
                modified = true
            }
        })

        if (modified) {
            Lockr.set(STORAGE_KEYS.EXCEPTION_LOGS, exceptionLogs)
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED)
        }
    }

    const updateGroupVillages = function () {
        updateIncludedVillage()
        updateIgnoredVillage()
        updateOnlyVillage()
        updateExceptionLogs()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED)
    }

    const villageGroupLink = function (event, data) {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                removeFarmer(data.village_id)
                farmerListUpdated = true
            } else {
                removeTarget(data.village_id)

                addLog(LOG_TYPES.IGNORED_VILLAGE, {
                    villageId: data.village_id
                })
                addExceptionLog(data.village_id)
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE, {
                villageId: data.village_id
            })
            addExceptionLog(data.village_id)
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            let farmer = createFarmer(data.village_id)
            farmer.init().then(function () {
                if (running) {
                    farmer.start()
                }
            })

            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const villageGroupUnlink = function (event, data) {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                let farmer = createFarmer(data.village_id)
                farmer.init().then(function () {
                    if (running) {
                        farmer.start()
                    }
                })

                farmerListUpdated = true
            } else {
                reloadTargets()

                addLog(LOG_TYPES.IGNORED_VILLAGE_REMOVED, {
                    villageId: data.village_id
                })
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE_REMOVED, {
                villageId: data.village_id
            })
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            removeFarmer(data.village_id)
            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const validGroups = function (_flag) {
        const gameGroups = modelDataService.getGroupList().getGroups()
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]

        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const validedGroupIgnore = hasOwn.call(gameGroups, groupIgnore) ? groupIgnore : settings.getDefault(SETTINGS.GROUP_IGNORE)
        const validedGroupsOnly = groupsOnly.filter(groupId => hasOwn.call(gameGroups, groupId))
        const validedGroupsInclude = groupsInclude.filter(groupId => hasOwn.call(gameGroups, groupId))

        settings.setAll({
            [SETTINGS.GROUP_IGNORE]: validedGroupIgnore,
            [SETTINGS.GROUP_ONLY]: validedGroupsOnly,
            [SETTINGS.GROUP_INCLUDE]: validedGroupsInclude
        }, _flag)
    }

    const removedGroupListener = function () {
        validGroups()
        updateGroupVillages()

        flushFarmers()
        reloadTargets()
        createFarmers()
    }

    const processPresets = function () {
        selectedPresets = []
        const playerPresets = modelDataService.getPresetList().getPresets()
        const activePresets = farmSettings[SETTINGS.PRESETS]

        activePresets.forEach(function (presetId) {
            if (!hasOwn.call(playerPresets, presetId)) {
                return
            }

            let preset = playerPresets[presetId]
            preset.load = getPresetHaul(preset)
            preset.travelTime = armyService.calculateTravelTime(preset, {
                barbarian: false,
                officers: false
            })

            selectedPresets.push(preset)
        })

        selectedPresets = selectedPresets.sort(function (a, b) {
            return a.travelTime - b.travelTime || b.load - a.load
        })
    }

    const ignoreVillage = function (villageId) {
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]

        if (!groupIgnore) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_LINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        })

        return true
    }

    const presetListener = function () {
        processPresets()

        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: ERROR_TYPES.NO_PRESETS
            })

            if (running) {
                farmOverflow.stop()
            }
        }
    }

    const reportListener = function (event, data) {
        if (!farmSettings[SETTINGS.IGNORE_ON_LOSS] || !farmSettings[SETTINGS.GROUP_IGNORE]) {
            return
        }

        if (!running || data.type !== COMMAND_TYPES.TYPES.ATTACK) {
            return
        }

        // 1 = nocasualties
        // 2 = casualties
        // 3 = defeat
        if (data.result !== 1 && isTarget(data.target_village_id)) {
            tempVillageReports[data.target_village_id] = {
                haul: data.haul,
                id: data.id,
                result: data.result,
                title: data.title
            }

            ignoreVillage(data.target_village_id)
        }
    }

    const commandSentListener = function (event, data) {
        if (!activeFarmer || !currentTarget) {
            return
        }

        if (data.origin.id !== activeFarmer.getId()) {
            return
        }

        if (data.target.id !== currentTarget.id) {
            return
        }

        if (data.direction === 'forward' && data.type === COMMAND_TYPES.TYPES.ATTACK) {
            activeFarmer.commandSent(data)
        }
    }

    const commandErrorListener = function (event, data) {
        if (!activeFarmer || !sendingCommand || !currentTarget) {
            return
        }

        if (data.cause === routeProvider.SEND_PRESET.type) {
            activeFarmer.commandError(data)
        }
    }

    const getPresetHaul = function (preset) {
        let haul = 0

        utils.each(preset.units, function (unitAmount, unitName) {
            if (unitAmount) {
                haul += unitsData[unitName].load * unitAmount
            }
        })

        return haul
    }

    const addExceptionLog = function (villageId) {
        exceptionLogs[villageId] = {
            time: timeHelper.gameTime(),
            report: tempVillageReports[villageId] || false
        }

        delete tempVillageReports[villageId]

        Lockr.set(STORAGE_KEYS.EXCEPTION_LOGS, exceptionLogs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED)
    }

    const addLog = function (type, data = {}) {
        if (typeof type !== 'string') {
            return false
        }

        if (!angular.isObject(data)) {
            data = {}
        }

        data.time = timeHelper.gameTime()
        data.type = type

        logs.unshift(data)
        trimAndSaveLogs()

        return true
    }

    const trimAndSaveLogs = function () {
        const limit = farmSettings[SETTINGS.LOGS_LIMIT]

        if (logs.length > limit) {
            logs.splice(logs.length - limit, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)
    }

    const isTargetBusy = function (attacking, otherAttacking, allVillagesLoaded) {
        const multipleFarmers = farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS]
        const singleAttack = farmSettings[SETTINGS.TARGET_SINGLE_ATTACK]

        if (multipleFarmers && allVillagesLoaded) {
            if (singleAttack && attacking) {
                return true
            }
        } else if (singleAttack) {
            if (attacking || otherAttacking) {
                return true
            }
        } else if (otherAttacking) {
            return true
        }

        return false
    }

    const enableRequiredPresets = function (villageId, callback) {
        const villagePresets = modelDataService.getPresetList().getPresetsByVillageId(villageId)
        let missingPresets = []

        selectedPresets.forEach(function (preset) {
            if (!hasOwn.call(villagePresets, preset.id)) {
                missingPresets.push(preset.id)
            }
        })

        if (missingPresets.length) {
            // include already enabled presets because you can't only enable
            // missing ones, you need to emit all you want enabled.
            for (let id in villagePresets) {
                if (hasOwn.call(villagePresets, id)) {
                    missingPresets.push(id)
                }
            }

            socketService.emit(routeProvider.ASSIGN_PRESETS, {
                village_id: villageId,
                preset_ids: missingPresets
            }, callback)

            return
        }

        callback()
    }

    const persistentRunningStart = function () {
        let cycleInterval = getCycleInterval()
        let attackInterval = getAttackInterval()
        let timeLimit = cycleInterval + (cycleInterval / 2) + attackInterval

        persistentRunningTimer = setInterval(function () {
            let now = timeHelper.gameTime()

            if (now - persistentRunningLastCheck > timeLimit) {
                farmOverflow.stop()
                setTimeout(farmOverflow.start, 5000)
            }
        }, PERSISTENT_RUNNING_CHECK_INTERVAL)
    }

    const persistentRunningStop = function () {
        clearInterval(persistentRunningTimer)
    }

    const persistentRunningUpdate = function () {
        persistentRunningLastCheck = timeHelper.gameTime()
    }

    const stopTimers = function () {
        clearTimeout(cycleTimer)
        clearTimeout(stepDelayTimer)
        clearTimeout(commandExpireTimer)

        cycleTimer = null
        stepDelayTimer = null
        commandExpireTimer = null
    }

    const getCycleInterval = function () {
        return Math.max(MINIMUM_FARMER_CYCLE_INTERVAL, farmSettings[SETTINGS.FARMER_CYCLE_INTERVAL] * 60 * 1000)
    }

    const getAttackInterval = function () {
        return Math.max(MINIMUM_ATTACK_INTERVAL, farmSettings[SETTINGS.ATTACK_INTERVAL] * 1000)
    }

    const Farmer = function (villageId) {
        this.villageId = villageId
        this.village = $player.getVillage(villageId)

        if (!this.village) {
            throw new Error(`new Farmer -> Village ${villageId} doesn't exist.`)
        }

        this.index = 0
        this.running = false
        this.initialized = false
        this.targets = false
        this.onCycleEndFn = noop
        this.status = STATUS.WAITING_CYCLE
    }

    Farmer.prototype.init = function () {
        let loadPromises = []

        if (!this.isInitialized()) {
            loadPromises.push(new Promise((resolve) => {
                if (this.isInitialized()) {
                    return resolve()
                }

                villageService.ensureVillageDataLoaded(this.villageId, resolve)
            }))

            loadPromises.push(new Promise((resolve) => {
                if (this.isInitialized()) {
                    return resolve()
                }

                this.loadTargets(() => {
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, {
                        villageId: this.villageId
                    })
                    resolve()
                })
            }))
        }

        return Promise.all(loadPromises).then(() => {
            this.initialized = true
        })
    }

    Farmer.prototype.start = function () {
        persistentRunningUpdate()

        if (this.running) {
            return false
        }

        if (!this.initialized) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY, {
                villageId: this.villageId
            })
            return false
        }

        if (!this.targets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS, {
                villageId: this.villageId
            })
            return false
        }

        activeFarmer = this
        this.running = true
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, {
            villageId: this.villageId
        })

        this.targetStep({
            delay: false
        })

        return true
    }

    Farmer.prototype.stop = function (reason) {
        this.running = false

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, {
            villageId: this.villageId,
            reason: reason
        })

        if (reason === ERROR_TYPES.USER_STOP) {
            this.setStatus(STATUS.USER_STOP)
        }

        stopTimers()

        this.onCycleEndFn(reason)
        this.onCycleEndFn = noop
    }

    Farmer.prototype.targetStep = async function (options = {}) {
        if (!this.running) {
            return false
        }

        persistentRunningUpdate()

        const commandList = this.village.getCommandListModel()
        const villageCommands = commandList.getOutgoingCommands(true, true)
        let selectedPreset = false
        let target
        let checkedLocalCommands = false
        let otherVillageAttacking
        let thisVillageAttacking
        let playerVillages

        const delayStep = () => {
            return new Promise((resolve, reject) => {
                if (options.delay) {
                    stepDelayTimer = setTimeout(() => {
                        stepDelayTimer = null

                        if (!this.running) {
                            return reject(STATUS.USER_STOP)
                        }

                        resolve()
                    }, utils.randomSeconds(getAttackInterval()))
                } else {
                    resolve()
                }
            })
        }

        const checkCommandLimit = () => {
            return new Promise((resolve, reject) => {
                const limit = VILLAGE_COMMAND_LIMIT - farmSettings[SETTINGS.PRESERVE_COMMAND_SLOTS]

                if (villageCommands.length >= limit) {
                    reject(STATUS.COMMAND_LIMIT)
                } else {
                    resolve()
                }
            })
        }

        const checkStorage = () => {
            return new Promise((resolve, reject) => {
                if (farmSettings[SETTINGS.IGNORE_FULL_STORAGE]) {
                    const resources = this.village.getResources()
                    const computed = resources.getComputed()
                    const maxStorage = resources.getMaxStorage()
                    const isFull = RESOURCES.every((type) => computed[type].currentStock === maxStorage)

                    if (isFull) {
                        return reject(STATUS.FULL_STORAGE)
                    }
                }

                resolve()
            })
        }

        const selectTarget = () => {
            return new Promise((resolve, reject) => {
                if (!this.targets.length) {
                    return reject(STATUS.NO_TARGETS)
                }

                if (this.index > this.targets.length || !this.targets[this.index]) {
                    return reject(STATUS.TARGET_CYCLE_END)
                }

                target = this.targets[this.index]

                resolve()
            })
        }

        const checkTarget = () => {
            return new Promise((resolve, reject) => {
                $mapData.getTownAtAsync(target.x, target.y, (data) => {
                    if (villageFilters.points(data.points)) {
                        return reject(STATUS.NOT_ALLOWED_POINTS)
                    }

                    socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                        target_id: target.id
                    }, (data) => {
                        if (!this.running) {
                            reject(STATUS.USER_STOP)
                        // abandoned village conquered by some noob.
                        } else if (target.character_id === null && data.owner_id !== null && !includedVillages.includes(target.id)) {
                            reject(STATUS.ABANDONED_CONQUERED)
                        } else if (target.attack_protection) {
                            reject(STATUS.PROTECTED_VILLAGE)
                        } else {
                            resolve()
                        }
                    })
                })
            })
        }

        const checkPresets = () => {
            return new Promise((resolve, reject) => {
                enableRequiredPresets(this.villageId, () => {
                    if (this.running) {
                        resolve()
                    } else {
                        reject(STATUS.USER_STOP)
                    }
                })
            })
        }

        const selectPreset = () => {
            return new Promise((resolve, reject) => {
                const villageUnits = this.village.getUnitInfo().getUnits()
                const maxTravelTime = farmSettings[SETTINGS.MAX_TRAVEL_TIME] * 60
                const villagePosition = this.village.getPosition()
                const targetDistance = math.actualDistance(villagePosition, target)

                utils.each(selectedPresets, (preset) => {
                    let enoughUnits = !Object.entries(preset.units).some((unit) => {
                        const name = unit[0]
                        const amount = unit[1]
                        
                        return villageUnits[name].in_town < amount
                    })

                    if (!enoughUnits) {
                        return
                    }

                    const travelTime = armyService.calculateTravelTime(preset, {
                        barbarian: !target.character_id,
                        officers: false
                    })

                    if (maxTravelTime > travelTime * targetDistance) {
                        selectedPreset = preset
                        resolve()
                    } else {
                        // why reject with TIME_LIMIT if there are more presets to check?
                        // because the preset list is sorted by travel time.
                        reject(STATUS.TIME_LIMIT)
                    }

                    return false
                })

                if (!selectedPreset) {
                    reject(STATUS.NO_UNITS)
                }
            })
        }

        const checkLocalCommands = () => {
            return new Promise((resolve, reject) => {
                otherVillageAttacking = false
                playerVillages = $player.getVillageList()
                
                const allVillagesLoaded = playerVillages.every((anotherVillage) => anotherVillage.isInitialized(VILLAGE_CONFIG.READY_STATES.OWN_COMMANDS))

                if (allVillagesLoaded) {
                    otherVillageAttacking = playerVillages.some((anotherVillage) => {
                        if (anotherVillage.getId() === this.villageId) {
                            return false
                        }

                        const otherVillageCommands = anotherVillage.getCommandListModel().getOutgoingCommands(true, true)

                        return otherVillageCommands.some((command) => {
                            return command.targetVillageId === target.id && command.data.direction === 'forward'
                        })
                    })
                }

                thisVillageAttacking = villageCommands.some((command) => {
                    return command.data.target.id === target.id && command.data.direction === 'forward'
                })

                if (isTargetBusy(thisVillageAttacking, otherVillageAttacking, allVillagesLoaded)) {
                    return reject(STATUS.BUSY_TARGET)
                }

                if (allVillagesLoaded) {
                    checkedLocalCommands = true
                }

                resolve()
            })
        }

        const minimumInterval = () => {
            return new Promise((resolve, reject) => {
                if (!thisVillageAttacking && !otherVillageAttacking) {
                    return resolve()
                }

                const multipleAttacksInterval = farmSettings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL] * 60

                if (!multipleAttacksInterval) {
                    return resolve()
                }

                // if TARGET_SINGLE_ATTACK is enabled, and TARGET_MULTIPLE_FARMERS is disabled
                // there's no reason the check, since the target is allowed to receive multiple
                // attacks simultaneously.
                if (farmSettings[SETTINGS.TARGET_SINGLE_ATTACK] && !farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS]) {
                    return resolve()
                }

                const now = Math.round(timeHelper.gameTime() / 1000)
                const villages = farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS] ? playerVillages : [this.village]
                const position = this.village.getPosition()
                const distance = math.actualDistance(position, target)
                const singleFieldtravelTime = armyService.calculateTravelTime(selectedPreset, {
                    barbarian: !target.character_id,
                    officers: true,
                    effects: true
                })
                const commandTravelTime = armyService.getTravelTimeForDistance(selectedPreset, singleFieldtravelTime, distance, COMMAND_TYPES.TYPES.ATTACK)

                const busyTarget = villages.some((village) => {
                    const commands = village.getCommandListModel().getOutgoingCommands(true, true)
                    const targetCommands = commands.filter((command) => command.targetVillageId === target.id && command.data.direction === 'forward')

                    if (targetCommands.length) {
                        return targetCommands.some((command) => {
                            return Math.abs((now + commandTravelTime) - command.time_completed) < multipleAttacksInterval
                        })
                    }
                })

                if (busyTarget) {
                    return reject(STATUS.BUSY_TARGET)
                }

                resolve()
            })
        }

        const checkLoadedCommands = () => {
            return new Promise((resolve, reject) => {
                if (checkedLocalCommands) {
                    return resolve()
                }

                socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                    my_village_id: this.villageId,
                    village_id: target.id,
                    num_reports: 0
                }, (data) => {
                    if (!this.running) {
                        return reject(STATUS.USER_STOP)
                    }

                    const targetCommands = data.commands.own.filter((command) => command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward')
                    const otherAttacking = targetCommands.some((command) => command.start_village_id !== this.villageId)
                    const attacking = targetCommands.some((command) => command.start_village_id === this.villageId)

                    if (isTargetBusy(attacking, otherAttacking, true)) {
                        return reject(STATUS.BUSY_TARGET)
                    }

                    resolve()
                })
            })
        }

        const prepareAttack = () => {
            if (!this.running) {
                return false
            }

            this.setStatus(STATUS.ATTACKING)

            sendingCommand = true
            currentTarget = target
            this.index++

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: this.villageId,
                target_village: target.id,
                army_preset_id: selectedPreset.id,
                type: COMMAND_TYPES.TYPES.ATTACK
            })
        }

        const stepStatus = (status) => {
            stopTimers()

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_STATUS, {
                villageId: this.villageId,
                error: status
            })

            switch (status) {
                case STATUS.TIME_LIMIT:
                case STATUS.BUSY_TARGET:
                case STATUS.ABANDONED_CONQUERED:
                case STATUS.PROTECTED_VILLAGE: {
                    this.index++
                    this.setStatus(status)
                    this.targetStep(options)
                    break
                }
                case STATUS.USER_STOP: {
                    this.setStatus(status)
                    break
                }
                case STATUS.NOT_ALLOWED_POINTS: {
                    this.index++
                    this.setStatus(status)
                    removeTarget(target.id)
                    this.targetStep(options)
                    break
                }
                case STATUS.NO_UNITS:
                case STATUS.NO_TARGETS:
                case STATUS.FULL_STORAGE:
                case STATUS.COMMAND_LIMIT: {
                    this.index++
                    this.setStatus(status)
                    this.stop(status)
                    break
                }
                case STATUS.TARGET_CYCLE_END: {
                    this.index = 0
                    this.setStatus(status)
                    this.stop(status)
                    break
                }
                case STATUS.EXPIRED_STEP: {
                    this.setStatus(status)
                    this.targetStep()
                    break
                }
                default: {
                    // eslint-disable-next-line no-console
                    console.error('Unknown status:', status)
                    this.index++
                    this.setStatus(STATUS.UNKNOWN)
                    this.stop(STATUS.UNKNOWN)
                    break
                }
            }
        }

        let attackPromise = new Promise((resolve, reject) => {
            delayStep()
                .then(checkCommandLimit)
                .then(checkStorage)
                .then(selectTarget)
                .then(checkTarget)
                .then(checkPresets)
                .then(selectPreset)
                .then(checkLocalCommands)
                .then(minimumInterval)
                .then(checkLoadedCommands)
                .then(resolve)
                .catch(reject)
        })

        let expirePromise = new Promise((resolve, reject) => {
            commandExpireTimer = setTimeout(() => {
                if (this.running) {
                    reject(STATUS.EXPIRED_STEP)
                }
            }, STEP_EXPIRE_TIME)
        })

        Promise.race([attackPromise, expirePromise])
            .then(prepareAttack)
            .catch(stepStatus)
    }

    Farmer.prototype.setStatus = function (newStatus) {
        this.status = newStatus
    }

    Farmer.prototype.getStatus = function () {
        return this.status || STATUS.UNKNOWN
    }

    Farmer.prototype.commandSent = function (data) {
        sendingCommand = false
        currentTarget = false

        stopTimers()

        addLog(LOG_TYPES.ATTACKED_VILLAGE, {
            targetId: data.target.id
        })

        this.targetStep({
            delay: true
        })
    }

    Farmer.prototype.commandError = function () {
        sendingCommand = false
        currentTarget = false

        this.stop(STATUS.COMMAND_ERROR)
    }

    Farmer.prototype.onCycleEnd = function (handler) {
        this.onCycleEndFn = handler
    }

    Farmer.prototype.loadTargets = function (callback) {
        const pos = this.village.getPosition()

        twoMapData.load((loadedTargets) => {
            this.targets = calcDistances(loadedTargets, pos)
            this.targets = filterTargets(this.targets, pos)
            this.targets = sortTargets(this.targets)
            this.targets = this.targets.slice(0, farmSettings[SETTINGS.TARGET_LIMIT_PER_VILLAGE])

            if (typeof callback === 'function') {
                callback(this.targets)
            }
        })
    }

    Farmer.prototype.getTargets = function () {
        return this.targets
    }

    Farmer.prototype.getIndex = function () {
        return this.index
    }

    Farmer.prototype.getVillage = function () {
        return this.village
    }

    Farmer.prototype.isRunning = function () {
        return this.running
    }

    Farmer.prototype.isInitialized = function () {
        return this.initialized
    }

    Farmer.prototype.removeTarget = function (targetId) {
        if (typeof targetId !== 'number' || !this.targets) {
            return false
        }

        this.targets = this.targets.filter(function (target) {
            return target.id !== targetId
        })

        return true
    }

    Farmer.prototype.getId = function () {
        return this.villageId
    }

    const createFarmer = function (villageId) {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]

        villageId = parseInt(villageId, 10)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

        if (ignoredVillages.includes(villageId)) {
            return false
        }

        let farmer = farmOverflow.getFarmer(villageId)

        if (!farmer) {
            farmer = new Farmer(villageId)
            farmers.push(farmer)
        }

        return farmer
    }

    const createFarmers = function () {
        utils.each($player.getVillages(), function (village, villageId) {
            createFarmer(villageId)
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
    }

    /**
     * Clean farmer instances by removing villages based on
     * groups-only, only-villages and ignore-villages group filters.
     */
    const flushFarmers = function () {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        let removeIds = []

        farmers.forEach(function (farmer) {
            let villageId = farmer.getId()

            if (groupsOnly.length && !onlyVillages.includes(villageId)) {
                removeIds.push(villageId)
            } else if (ignoredVillages.includes(villageId)) {
                removeIds.push(villageId)
            }
        })

        if (removeIds.length) {
            removeIds.forEach(function (removeId) {
                removeFarmer(removeId)
            })

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const removeFarmer = function (farmerId) {
        for (let i = 0; i < farmers.length; i++) {
            if (farmers[i].getId() === farmerId) {
                farmers[i].stop(ERROR_TYPES.KILL_FARMER)
                farmers.splice(i, i + 1)

                return true
            }
        }

        return false
    }

    const farmerStep = function (status) {
        persistentRunningUpdate()

        if (!farmers.length) {
            activeFarmer = false
        } else if (farmerIndex >= farmers.length) {
            farmerIndex = 0
            activeFarmer = false
            nextCycleDate = timeHelper.gameTime() + getCycleInterval()
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_END)
        } else {
            activeFarmer = farmers[farmerIndex]
        }

        if (activeFarmer) {
            activeFarmer.onCycleEnd(function (reason) {
                if (reason !== ERROR_TYPES.USER_STOP) {
                    farmerIndex++
                    farmerStep()
                }
            })

            if (status === CYCLE_BEGIN) {
                nextCycleDate = null
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)
            }

            activeFarmer.start()
        } else {
            cycleTimer = setTimeout(function () {
                cycleTimer = null
                farmerIndex = 0
                nextCycleDate = null
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)
                farmerStep()
            }, getCycleInterval())
        }
    }

    const isTarget = function (targetId) {
        for (let i = 0; i < farmers.length; i++) {
            let farmer = farmers[i]
            let targets = farmer.getTargets()

            for (let j = 0; j < targets.length; j++) {
                let target = targets[j]

                if (target.id === targetId) {
                    return true
                }
            }
        }

        return false
    }

    const removeTarget = function (targetId) {
        farmers.forEach(function (farmer) {
            farmer.removeTarget(targetId)
        })
    }

    const reloadTargets = function () {
        twoMapData.load(function () {
            farmers.forEach(function (farmer) {
                farmer.loadTargets()
            })
        }, true)
    }

    let farmOverflow = {}

    farmOverflow.init = function () {
        initialized = true
        logs = Lockr.get(STORAGE_KEYS.LOGS, [])
        exceptionLogs = Lockr.get(STORAGE_KEYS.EXCEPTION_LOGS, {})
        $player = modelDataService.getSelectedCharacter()
        unitsData = modelDataService.getGameData().getUnitsObject()

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates, _flag) {
            farmSettings = settings.getAll()

            if (_flag === IGNORE_UPDATES) {
                return
            }

            if (updates[UPDATES.PRESET]) {
                processPresets()
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroupVillages()
            }

            if (updates[UPDATES.TARGETS]) {
                reloadTargets()
            }

            if (updates[UPDATES.VILLAGES]) {
                flushFarmers()
                createFarmers()
            }

            if (updates[UPDATES.LOGS]) {
                trimAndSaveLogs()
            }

            if (updates[UPDATES.INTERVAL_TIMERS]) {
                reloadTimers()
            }
        })

        farmSettings = settings.getAll()

        validGroups(IGNORE_UPDATES)
        updateGroupVillages()
        createFarmers()

        ready(function () {
            processPresets()
        }, 'presets')

        ready(function () {
            farmers.forEach(function (farmer) {
                farmer.loadTargets()
            })
        }, 'minimap_data')

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, presetListener)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, presetListener)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, villageGroupLink)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, villageGroupUnlink)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, removedGroupListener)
        $rootScope.$on(eventTypeProvider.COMMAND_SENT, commandSentListener)
        $rootScope.$on(eventTypeProvider.MESSAGE_ERROR, commandErrorListener)
        $rootScope.$on(eventTypeProvider.REPORT_NEW, reportListener)
    }

    farmOverflow.start = function () {
        let readyFarmers

        if (running) {
            return false
        }

        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: ERROR_TYPES.NO_PRESETS
            })

            return false
        }

        running = true
        readyFarmers = []

        farmers.forEach(function (farmer) {
            readyFarmers.push(new Promise(function (resolve) {
                farmer.init().then(resolve)
            }))
        })

        if (!readyFarmers.length) {
            running = false
            return false
        }

        Promise.all(readyFarmers).then(function () {
            farmerStep(CYCLE_BEGIN)
        })

        persistentRunningUpdate()
        persistentRunningStart()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_START)

        addLog(LOG_TYPES.FARM_START)
    }

    farmOverflow.stop = function (reason = STATUS.USER_STOP) {
        if (activeFarmer) {
            activeFarmer.stop(reason)
            
            if (reason !== STATUS.USER_STOP) {
                nextCycleDate = timeHelper.gameTime() + getCycleInterval()
            }

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_END, reason)
        } else {
            nextCycleDate = null
        }

        running = false

        stopTimers()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
            reason: reason
        })

        persistentRunningStop()

        if (reason === STATUS.USER_STOP) {
            addLog(LOG_TYPES.FARM_STOP)
        }
    }

    farmOverflow.getFarmer = function (farmerId) {
        return farmers.find(function (farmer) {
            return farmer.getId() === farmerId
        })
    }

    farmOverflow.getFarmers = function () {
        return farmers
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.getExceptionVillages = function () {
        return {
            included: includedVillages,
            ignored: ignoredVillages
        }
    }

    farmOverflow.getExceptionLogs = function () {
        return exceptionLogs
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.isRunning = function () {
        return running
    }

    farmOverflow.getLogs = function () {
        return logs
    }

    farmOverflow.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)

        return logs
    }

    farmOverflow.getNextCycleDate = function () {
        return nextCycleDate
    }

    farmOverflow.getCycleInterval = getCycleInterval

    return farmOverflow
})

define('two/farmOverflow/events', [], function () {
    angular.extend(eventTypeProvider, {
        FARM_OVERFLOW_START: 'farm_overflow_start',
        FARM_OVERFLOW_STOP: 'farm_overflow_stop',
        FARM_OVERFLOW_INSTANCE_READY: 'farm_overflow_instance_ready',
        FARM_OVERFLOW_INSTANCE_START: 'farm_overflow_instance_start',
        FARM_OVERFLOW_INSTANCE_STOP: 'farm_overflow_instance_stop',
        FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS: 'farm_overflow_instance_error_no_targets',
        FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY: 'farm_overflow_instance_error_not_ready',
        FARM_OVERFLOW_INSTANCE_STEP_STATUS: 'farm_overflow_instance_command_status',
        FARM_OVERFLOW_PRESETS_LOADED: 'farm_overflow_presets_loaded',
        FARM_OVERFLOW_LOGS_UPDATED: 'farm_overflow_log_updated',
        FARM_OVERFLOW_COMMAND_SENT: 'farm_overflow_command_sent',
        FARM_OVERFLOW_IGNORED_TARGET: 'farm_overflow_ignored_target',
        FARM_OVERFLOW_VILLAGE_IGNORED: 'farm_overflow_village_ignored',
        FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED: 'farm_overflow_exception_villages_updated',
        FARM_OVERFLOW_FARMER_VILLAGES_UPDATED: 'farm_overflow_farmer_villages_updated',
        FARM_OVERFLOW_REPORTS_UPDATED: 'farm_overflow_reports_updated',
        FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED: 'farm_overflow_exception_logs_updated',
        FARM_OVERFLOW_CYCLE_BEGIN: 'farm_overflow_cycle_begin',
        FARM_OVERFLOW_CYCLE_END: 'farm_overflow_cycle_end'
    })
})

define('two/farmOverflow/ui', [
    'two/ui',
    'two/farmOverflow',
    'two/farmOverflow/types/status',
    'two/farmOverflow/types/errors',
    'two/farmOverflow/types/logs',
    'two/farmOverflow/settings',
    'two/Settings',
    'two/EventScope',
    'two/utils',
    'queues/EventQueue',
    'helper/time'
], function (
    interfaceOverflow,
    farmOverflow,
    STATUS,
    ERROR_TYPES,
    LOG_TYPES,
    SETTINGS,
    Settings,
    EventScope,
    utils,
    eventQueue,
    timeHelper
) {
    let $scope
    let settings
    let presetList = modelDataService.getPresetList()
    let groupList = modelDataService.getGroupList()
    let $button
    let villagesInfo = {}
    let villagesLabel = {}
    let cycleCountdownTimer = null
    const TAB_TYPES = {
        SETTINGS: 'settings',
        VILLAGES: 'villages',
        LOGS: 'logs'
    }

    const updateVisibleLogs = function () {
        const offset = $scope.pagination.offset
        const limit = $scope.pagination.limit

        $scope.visibleLogs = $scope.logs.slice(offset, offset + limit)
        $scope.pagination.count = $scope.logs.length

        $scope.visibleLogs.forEach(function (log) {
            if (log.villageId) {
                loadVillageInfo(log.villageId)
            }

            if (log.targetId) {
                loadVillageInfo(log.targetId)
            }
        })
    }

    // TODO: make it shared with other modules
    const loadVillageInfo = function (villageId) {
        if (villagesInfo[villageId]) {
            return villagesInfo[villageId]
        }

        villagesInfo[villageId] = true
        villagesLabel[villageId] = 'LOADING...'

        socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
            my_village_id: modelDataService.getSelectedVillage().getId(),
            village_id: villageId,
            num_reports: 1
        }, function (data) {
            villagesInfo[villageId] = {
                x: data.village_x,
                y: data.village_y,
                name: data.village_name,
                last_report: data.last_reports[0]
            }

            villagesLabel[villageId] = `${data.village_name} (${data.village_x}|${data.village_y})`
        })
    }

    const loadExceptionsInfo = function () {
        $scope.exceptionVillages.included.forEach(function (villageId) {
            loadVillageInfo(villageId)
        })
        $scope.exceptionVillages.ignored.forEach(function (villageId) {
            loadVillageInfo(villageId)
        })
    }

    const switchFarm = function () {
        if (farmOverflow.isRunning()) {
            farmOverflow.stop()
        } else {
            farmOverflow.start()
        }
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        $scope.saveButtonColor = 'orange'

        utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'farm_overflow'))
    }

    const removeIgnored = function (villageId) {
        const groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)
        const groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnore)

        if (!groupVillages.includes(villageId)) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_UNLINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        })
    }

    const removeIncluded = function (villageId) {
        const groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)

        groupsInclude.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)

            if (groupVillages.includes(villageId)) {
                socketService.emit(routeProvider.GROUPS_UNLINK_VILLAGE, {
                    group_id: groupId,
                    village_id: villageId
                })
            }
        })
    }

    const checkCycleInterval = function () {
        let nextCycleDate = farmOverflow.getNextCycleDate()

        if (nextCycleDate) {
            $scope.showCycleTimer = true
            $scope.nextCycleCountdown = nextCycleDate - timeHelper.gameTime()

            cycleCountdownTimer = setInterval(function () {
                $scope.nextCycleCountdown -= 1000
            }, 1000)
        }
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            })
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })

            $scope.groupsWithDisabled = Settings.encodeList(groupList.getGroups(), {
                disabled: true,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            utils.notif('success', $filter('i18n')('farm_started', $rootScope.loc.ale, 'farm_overflow'))
        },
        stop: function (event, data) {
            $scope.running = false
            $scope.showCycleTimer = false
            clearInterval(cycleCountdownTimer)

            switch (data.reason) {
                case ERROR_TYPES.NO_PRESETS: {
                    utils.notif('success', $filter('i18n')('no_preset', $rootScope.loc.ale, 'farm_overflow'))
                    break
                }
                case ERROR_TYPES.USER_STOP: {
                    utils.notif('success', $filter('i18n')('farm_stopped', $rootScope.loc.ale, 'farm_overflow'))
                    break
                }
            }
        },
        updateLogs: function () {
            $scope.logs = angular.copy(farmOverflow.getLogs())
            updateVisibleLogs()

            if (!$scope.logs.length) {
                utils.notif('success', $filter('i18n')('reseted_logs', $rootScope.loc.ale, 'farm_overflow'))
            }
        },
        updateFarmerVillages: function () {
            $scope.farmers = farmOverflow.getFarmers()
        },
        updateExceptionVillages: function () {
            $scope.exceptionVillages = farmOverflow.getExceptionVillages()
            loadExceptionsInfo()
        },
        updateExceptionLogs: function () {
            $scope.exceptionLogs = farmOverflow.getExceptionLogs()
        },
        onCycleBegin: function () {
            $scope.showCycleTimer = false
            clearInterval(cycleCountdownTimer)
        },
        onCycleEnd: function (event, reason) {
            if (reason === STATUS.USER_STOP) {
                return
            }
            
            $scope.showCycleTimer = true
            $scope.nextCycleCountdown = farmOverflow.getCycleInterval()

            cycleCountdownTimer = setInterval(function () {
                $scope.nextCycleCountdown -= 1000
            }, 1000)
        }
    }

    const init = function () {
        settings = farmOverflow.getSettings()
        $button = interfaceOverflow.addMenuButton('Farmer', 10)

        $button.addEventListener('click', function () {
            buildWindow()
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_START, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_STOP, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        interfaceOverflow.addTemplate('twoverflow_farm_overflow_window', `<div id=\"two-farmoverflow\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Farmer</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.VILLAGES)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.VILLAGES}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.VILLAGES}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.VILLAGES}\">{{ TAB_TYPES.VILLAGES | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ TAB_TYPES.LOGS | i18n:loc.ale:'common' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><tr><th colspan=\"2\">{{ 'groups_presets' | i18n:loc.ale:'farm_overflow' }}<tr><td><span class=\"ff-cell-fix\">{{ 'presets' | i18n:loc.ale:'farm_overflow' }}</span><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESETS]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'group_ignored' | i18n:loc.ale:'farm_overflow' }}</span><td class=\"snowflake\"><div select=\"\" list=\"groupsWithDisabled\" selected=\"settings[SETTINGS.GROUP_IGNORE]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'group_include' | i18n:loc.ale:'farm_overflow' }}</span><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_INCLUDE]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'group_only' | i18n:loc.ale:'farm_overflow' }}</span><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_ONLY]\" drop-down=\"true\"></div></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'misc' | i18n:loc.ale:'farm_overflow' }}<tr><td><span class=\"ff-cell-fix\">{{ 'attack_interval' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.ATTACK_INTERVAL].min\" max=\"settingsMap[SETTINGS.ATTACK_INTERVAL].max\" value=\"settings[SETTINGS.ATTACK_INTERVAL]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.ATTACK_INTERVAL]\"><tr><td><span class=\"ff-cell-fix\">{{ 'preserve_command_slots' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_COMMAND_SLOTS].min\" max=\"settingsMap[SETTINGS.PRESERVE_COMMAND_SLOTS].max\" value=\"settings[SETTINGS.PRESERVE_COMMAND_SLOTS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_COMMAND_SLOTS]\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'ignore_on_loss' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"settings[SETTINGS.GROUP_IGNORE].value\" border=\"true\" value=\"settings[SETTINGS.IGNORE_ON_LOSS]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'ignore_full_storage' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.IGNORE_FULL_STORAGE]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'target_limit_per_village' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.TARGET_LIMIT_PER_VILLAGE].min\" max=\"settingsMap[SETTINGS.TARGET_LIMIT_PER_VILLAGE].max\" value=\"settings[SETTINGS.TARGET_LIMIT_PER_VILLAGE]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TARGET_LIMIT_PER_VILLAGE]\"></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'step_cycle_header' | i18n:loc.ale:'farm_overflow' }}<tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'target_single_attack' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.TARGET_SINGLE_ATTACK]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'target_multiple_farmers' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.TARGET_MULTIPLE_FARMERS]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'farmer_cycle_interval' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.FARMER_CYCLE_INTERVAL].min\" max=\"settingsMap[SETTINGS.FARMER_CYCLE_INTERVAL].max\" value=\"settings[SETTINGS.FARMER_CYCLE_INTERVAL]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.FARMER_CYCLE_INTERVAL]\"><tr><td><span class=\"ff-cell-fix\">{{ 'multiple_attacks_interval' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MULTIPLE_ATTACKS_INTERVAL].min\" max=\"settingsMap[SETTINGS.MULTIPLE_ATTACKS_INTERVAL].max\" value=\"settings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL]\" enabled=\"!(settings[SETTINGS.TARGET_SINGLE_ATTACK] && !settings[SETTINGS.TARGET_MULTIPLE_FARMERS])\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL]\" ng-disabled=\"settings[SETTINGS.TARGET_SINGLE_ATTACK] && !settings[SETTINGS.TARGET_MULTIPLE_FARMERS]\"></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'target_filters' | i18n:loc.ale:'farm_overflow' }}<tr><td><span class=\"ff-cell-fix\">{{ 'min_distance' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MIN_DISTANCE].min\" max=\"settingsMap[SETTINGS.MIN_DISTANCE].max\" value=\"settings[SETTINGS.MIN_DISTANCE]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MIN_DISTANCE]\"><tr><td><span class=\"ff-cell-fix\">{{ 'max_distance' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MAX_DISTANCE].min\" max=\"settingsMap[SETTINGS.MAX_DISTANCE].max\" value=\"settings[SETTINGS.MAX_DISTANCE]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MAX_DISTANCE]\"><tr><td><span class=\"ff-cell-fix\">{{ 'min_points' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MIN_POINTS].min\" max=\"settingsMap[SETTINGS.MIN_POINTS].max\" value=\"settings[SETTINGS.MIN_POINTS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MIN_POINTS]\"><tr><td><span class=\"ff-cell-fix\">{{ 'max_points' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MAX_POINTS].min\" max=\"settingsMap[SETTINGS.MAX_POINTS].max\" value=\"settings[SETTINGS.MAX_POINTS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MAX_POINTS]\"><tr><td><span class=\"ff-cell-fix\">{{ 'max_travel_time' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MAX_TRAVEL_TIME].min\" max=\"settingsMap[SETTINGS.MAX_TRAVEL_TIME].max\" value=\"settings[SETTINGS.MAX_TRAVEL_TIME]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MAX_TRAVEL_TIME]\"></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'others' | i18n:loc.ale:'common' }}<tr><td><span class=\"ff-cell-fix\">{{ 'logs_limit' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LOGS_LIMIT].min\" max=\"settingsMap[SETTINGS.LOGS_LIMIT].max\" value=\"settings[SETTINGS.LOGS_LIMIT]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LOGS_LIMIT]\"></table></div><div class=\"villages rich-text\" ng-show=\"selectedTab === TAB_TYPES.VILLAGES\"><p ng-show=\"showCycleTimer\" class=\"text-center\">{{ 'next_cycle_in' | i18n:loc.ale:'farm_overflow' }}: {{ nextCycleCountdown | readableMillisecondsFilter }}<h5 class=\"twx-section\">{{ 'farmer_villages' | i18n:loc.ale:'farm_overflow' }}</h5><p ng-show=\"!farmers.length\" class=\"text-center\">{{ 'no_farmer_villages' | i18n:loc.ale:'farm_overflow' }}<table class=\"tbl-border-light tbl-striped\" ng-show=\"farmers.length\"><col><col width=\"40%\"><col width=\"20%\"><tr><th>{{ 'villages' | i18n:loc.ale:'common' }}<th>{{ 'last_status' | i18n:loc.ale:'farm_overflow' }}<th>{{ 'target' | i18n:loc.ale:'common':2 }}<tr ng-repeat=\"farmer in farmers\"><td><span ng-class=\"{true:'icon-20x20-queue-indicator-long', false:'icon-20x20-queue-indicator-short'}[farmer.isRunning()]\"></span> <a class=\"link\" ng-click=\"openVillageInfo(farmer.getVillage().getId())\"><span class=\"icon-20x20-village\"></span> {{ farmer.getVillage().getName() }} ({{ farmer.getVillage().getX() }}|{{ farmer.getVillage().getY() }})</a><td>{{ 'status_' + farmer.getStatus() | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"farmer.getTargets()\"><span ng-if=\"farmer.isRunning()\">{{ farmer.getIndex() }} / </span><span>{{ farmer.getTargets().length }}</span><td ng-if=\"!farmer.getTargets()\">{{ 'not_loaded' | i18n:loc.ale:'farm_overflow' }}</table><h5 class=\"twx-section\">{{ 'ignored_targets' | i18n:loc.ale:'farm_overflow' }}</h5><p ng-if=\"!exceptionVillages.ignored.length\" class=\"text-center\">{{ 'no_ignored_targets' | i18n:loc.ale:'farm_overflow' }}<table class=\"ignored-villages tbl-border-light tbl-striped\" ng-show=\"exceptionVillages.ignored.length\"><col><col width=\"15%\"><col width=\"15%\"><col width=\"30px\"><tr><th>{{ 'villages' | i18n:loc.ale:'common' }}<th>{{ 'date' | i18n:loc.ale:'farm_overflow' }}<th>{{ 'reports' | i18n:loc.ale:'farm_overflow' }}<th><tr ng-repeat=\"villageId in exceptionVillages.ignored track by $index\"><td><a class=\"link\" ng-click=\"openVillageInfo(villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[villageId] }}</a><td>{{ exceptionLogs[villageId].time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}<td><span ng-if=\"exceptionLogs[villageId].report\"><a class=\"link\" ng-click=\"showReport(exceptionLogs[villageId].report.id)\" tooltip=\"\" tooltip-content=\"{{ exceptionLogs[villageId].report.title }}\"><span class=\"icon-20x20-report\"></span> {{ 'open_report' | i18n:loc.ale:'farm_overflow' }}</a> <span ng-class=\"{2:'icon-20x20-queue-indicator-medium', 3:'icon-20x20-queue-indicator-short'}[exceptionLogs[villageId].report.result]\"></span> <span ng-class=\"{'full': 'icon-26x26-capacity', 'partial':'icon-26x26-capacity-low', 'none':'hidden'}[exceptionLogs[villageId].report.haul]\"></span> </span><span ng-if=\"!exceptionLogs[villageId].report\">{{ 'no_report' | i18n:loc.ale:'farm_overflow' }}</span><td><a href=\"#\" class=\"size-20x20 btn-red icon-20x20-close\" ng-click=\"removeIgnored(villageId)\" tooltip=\"\" tooltip-content=\"\"></a></table><h5 class=\"twx-section\">{{ 'included_targets' | i18n:loc.ale:'farm_overflow' }}</h5><p ng-if=\"!exceptionVillages.included.length\" class=\"text-center\">{{ 'no_included_targets' | i18n:loc.ale:'farm_overflow' }}<table class=\"tbl-border-light tbl-striped\" ng-show=\"exceptionVillages.included.length\"><col><col width=\"15%\"><col width=\"30px\"><tr><th>{{ 'villages' | i18n:loc.ale:'common' }}<th>{{ 'date' | i18n:loc.ale:'farm_overflow' }}<th><tr ng-repeat=\"villageId in exceptionVillages.included track by $index\"><td><a class=\"link\" ng-click=\"openVillageInfo(villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[villageId] }}</a><td>{{ exceptionLogs[villageId].time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}<td><a href=\"#\" class=\"size-20x20 btn-red icon-20x20-close\" ng-click=\"removeIncluded(villageId)\" tooltip=\"\" tooltip-content=\"\"></a></table></div><div class=\"logs rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><div class=\"page-wrap\" pagination=\"pagination\"></div><p class=\"text-center\" ng-show=\"!visibleLogs.length\">{{ 'no_logs' | i18n:loc.ale:'farm_overflow' }}<table class=\"log-list tbl-border-light tbl-striped\" ng-show=\"visibleLogs.length\"><col width=\"100px\"><col width=\"30px\"><col><tr ng-repeat=\"log in visibleLogs track by $index\"><td>{{ log.time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}<td><span class=\"icon-bg-black\" ng-class=\"{
                                'icon-26x26-dot-green': log.type === LOG_TYPES.FARM_START,
                                'icon-26x26-dot-red': log.type === LOG_TYPES.FARM_STOP,
                                'icon-26x26-check-negative': log.type === LOG_TYPES.IGNORED_VILLAGE || log.type === LOG_TYPES.INCLUDED_VILLAGE_REMOVED,
                                'icon-26x26-check-positive': log.type === LOG_TYPES.INCLUDED_VILLAGE || log.type === LOG_TYPES.IGNORED_VILLAGE_REMOVED,
                                'icon-26x26-attack-small': log.type === LOG_TYPES.ATTACKED_VILLAGE}\"></span><td ng-if=\"log.type === LOG_TYPES.ATTACKED_VILLAGE\"><span class=\"icon-26x26-attack-small\"></span> <a class=\"link\" ng-click=\"openVillageInfo(log.targetId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.targetId] }}</a><td ng-if=\"log.type === LOG_TYPES.IGNORED_VILLAGE\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'ignored_village' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.IGNORED_VILLAGE_REMOVED\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'ignored_village_removed' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.INCLUDED_VILLAGE\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'included_village' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.INCLUDED_VILLAGE_REMOVED\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'included_village_removed' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.FARM_START\">{{ 'farm_started' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.FARM_STOP\">{{ 'farm_stopped' | i18n:loc.ale:'farm_overflow' }}</table><div class=\"page-wrap\" pagination=\"pagination\"></div></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><a href=\"#\" class=\"btn-border btn-{{ saveButtonColor }}\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"clearLogs()\">{{ 'clear_logs' | i18n:loc.ale:'farm_overflow' }}</a><li><a href=\"#\" ng-class=\"{false:'btn-green', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchFarm()\"><span ng-show=\"running\">{{ 'pause' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'start' | i18n:loc.ale:'common' }}</span></a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-farmoverflow .settings table{margin-bottom:15px}#two-farmoverflow .settings input.textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-farmoverflow .settings input.textfield-border.fit{width:100%}#two-farmoverflow .settings span.select-wrapper{width:219px}#two-farmoverflow .settings a.select-handler{line-height:28px}#two-farmoverflow .settings td.snowflake a.select-handler{line-height:31px}#two-farmoverflow .settings .range-container{width:250px}#two-farmoverflow .villages td{padding:2px 5px;white-space:nowrap}#two-farmoverflow .villages .hidden{display:none}#two-farmoverflow .logs .status tr{height:25px}#two-farmoverflow .logs .status td{padding:0 6px}#two-farmoverflow .logs .log-list{margin-bottom:10px}#two-farmoverflow .logs .log-list td{white-space:nowrap;text-align:center;padding:0 5px}#two-farmoverflow .logs .log-list td .village-link{max-width:200px;white-space:nowrap;text-overflow:ellipsis}#two-farmoverflow .icon-20x20-village:before{margin-top:-11px}')
    }

    const buildWindow = function () {
        let ignoreWatch = true

        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.LOG_TYPES = LOG_TYPES
        $scope.running = farmOverflow.isRunning()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.farmers = farmOverflow.getFarmers()
        $scope.villagesLabel = villagesLabel
        $scope.villagesInfo = villagesInfo
        $scope.exceptionVillages = farmOverflow.getExceptionVillages()
        $scope.exceptionLogs = farmOverflow.getExceptionLogs()
        $scope.logs = farmOverflow.getLogs()
        $scope.visibleLogs = []
        $scope.showCycleTimer = false
        $scope.nextCycleCountdown = 0
        $scope.saveButtonColor = 'orange'
        $scope.settingsMap = settings.settingsMap

        $scope.pagination = {
            count: $scope.logs.length,
            offset: 0,
            loader: updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        settings.injectScope($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()
        updateVisibleLogs()
        loadExceptionsInfo()
        checkCycleInterval()

        // scope functions
        $scope.switchFarm = switchFarm
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.clearLogs = farmOverflow.clearLogs
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.showReport = reportService.showReport
        $scope.removeIgnored = removeIgnored
        $scope.removeIncluded = removeIncluded

        let eventScope = new EventScope('twoverflow_farm_overflow_window', function onDestroy () {
            clearInterval(cycleCountdownTimer)
        })

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_STOP, eventHandlers.stop)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED, eventHandlers.updateFarmerVillages)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED, eventHandlers.updateExceptionVillages)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED, eventHandlers.updateExceptionLogs)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN, eventHandlers.onCycleBegin)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_CYCLE_END, eventHandlers.onCycleEnd)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_overflow_window', $scope)

        $scope.$watch('settings', function () {
            if (!ignoreWatch) {
                $scope.saveButtonColor = 'red'
            }

            ignoreWatch = false
        }, true)
    }

    return init
})

define('two/farmOverflow/settings', [], function () {
    return {
        PRESETS: 'presets',
        GROUP_IGNORE: 'group_ignore',
        GROUP_INCLUDE: 'group_include',
        GROUP_ONLY: 'group_only',
        MAX_DISTANCE: 'max_distance',
        MIN_DISTANCE: 'min_distance',
        IGNORE_FULL_STORAGE: 'ignore_full_storage',        
        ATTACK_INTERVAL: 'attack_interval',
        MAX_TRAVEL_TIME: 'max_travel_time',
        TARGET_SINGLE_ATTACK: 'target_single_attack',
        TARGET_MULTIPLE_FARMERS: 'target_multiple_farmers',
        MULTIPLE_ATTACKS_INTERVAL: 'multiple_attacks_interval',
        PRESERVE_COMMAND_SLOTS: 'preserve_command_slots',
        FARMER_CYCLE_INTERVAL: 'farmer_cycle_interval',
        MIN_POINTS: 'min_points',
        MAX_POINTS: 'max_points',
        LOGS_LIMIT: 'logs_limit',
        IGNORE_ON_LOSS: 'ignore_on_loss',
        TARGET_LIMIT: 'target_limit'
    }
})

define('two/farmOverflow/settings/updates', function () {
    return {
        PRESET: 'preset',
        GROUPS: 'groups',
        TARGETS: 'targets',
        VILLAGES: 'villages',
        WAITING_VILLAGES: 'waiting_villages',
        FULL_STORAGE: 'full_storage',
        LOGS: 'logs',
        INTERVAL_TIMERS: 'interval_timers'
    }
})

define('two/farmOverflow/settings/map', [
    'two/farmOverflow/settings',
    'two/farmOverflow/settings/updates'
], function (
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [
                UPDATES.PRESET,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUP_IGNORE]: {
            default: false,
            updates: [
                UPDATES.GROUPS,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            type: 'groups'
        },
        [SETTINGS.GROUP_INCLUDE]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP_ONLY]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
                UPDATES.VILLAGES,
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.ATTACK_INTERVAL]: {
            default: 2,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 0,
            max: 120
        },
        [SETTINGS.FARMER_CYCLE_INTERVAL]: {
            default: 5,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 1,
            max: 120
        },
        [SETTINGS.TARGET_SINGLE_ATTACK]: {
            default: false,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.TARGET_MULTIPLE_FARMERS]: {
            default: true,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'checkbox'
        },
        [SETTINGS.MULTIPLE_ATTACKS_INTERVAL]: {
            default: 5,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 0,
            max: 60
        },
        [SETTINGS.PRESERVE_COMMAND_SLOTS]: {
            default: 5,
            updates: [],
            inputType: 'number',
            min: 0,
            max: 50
        },
        [SETTINGS.IGNORE_ON_LOSS]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.IGNORE_FULL_STORAGE]: {
            default: true,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'checkbox'
        },
        [SETTINGS.MIN_DISTANCE]: {
            default: 0,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 50
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 15,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 50
        },
        [SETTINGS.MIN_POINTS]: {
            default: 0,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 11223
        },
        [SETTINGS.MAX_POINTS]: {
            default: 3600,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 11223
        },
        [SETTINGS.MAX_TRAVEL_TIME]: {
            default: 90,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 0,
            max: 300
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [UPDATES.LOGS],
            inputType: 'number',
            min: 0,
            max: 2000
        },
        [SETTINGS.TARGET_LIMIT_PER_VILLAGE]: {
            default: 25,
            updates: [UPDATES.TARGETS],
            min: 0,
            max: 500
        }
    }
})

define('two/farmOverflow/types/errors', [], function () {
    return {
        NO_PRESETS: 'no_presets',
        USER_STOP: 'user_stop',
        KILL_FARMER: 'kill_farmer'
    }
})

define('two/farmOverflow/types/status', [], function () {
    return {
        TIME_LIMIT: 'time_limit',
        COMMAND_LIMIT: 'command_limit',
        FULL_STORAGE: 'full_storage',
        NO_UNITS: 'no_units',
        NO_SELECTED_VILLAGE: 'no_selected_village',
        ABANDONED_CONQUERED: 'abandoned_conquered',
        PROTECTED_VILLAGE: 'protected_village',
        BUSY_TARGET: 'busy_target',
        NO_TARGETS: 'no_targets',
        TARGET_CYCLE_END: 'target_cycle_end',
        FARMER_CYCLE_END: 'farmer_cycle_end',
        COMMAND_ERROR: 'command_error',
        NOT_ALLOWED_POINTS: 'not_allowed_points',
        UNKNOWN: 'unknown',
        ATTACKING: 'attacking',
        WAITING_CYCLE: 'waiting_cycle',
        USER_STOP: 'user_stop',
        EXPIRED_STEP: 'expired_step'
    }
})

define('two/farmOverflow/types/logs', [], function () {
    return {
        FARM_START: 'farm_start',
        FARM_STOP: 'farm_stop',
        IGNORED_VILLAGE: 'ignored_village',
        INCLUDED_VILLAGE: 'included_village',
        IGNORED_VILLAGE_REMOVED: 'ignored_village_removed',
        INCLUDED_VILLAGE_REMOVED: 'included_village_removed',
        ATTACKED_VILLAGE: 'attacked_village'
    }
})

require([
    'two/ready',
    'two/farmOverflow',
    'two/farmOverflow/ui',
    'two/farmOverflow/events'
], function (
    ready,
    farmOverflow,
    farmOverflowInterface
) {
    if (farmOverflow.isInitialized()) {
        return false
    }

    ready(function () {
        farmOverflow.init()
        farmOverflowInterface()
    }, ['map', 'presets'])
})

define('two/minimap', [
    'two/minimap/types/actions',
    'two/minimap/types/mapSizes',
    'two/minimap/settings',
    'two/minimap/settings/map',
    'two/minimap/settings/updates',
    'two/utils',
    'two/ready',
    'two/Settings',
    'two/mapData',
    'queues/EventQueue',
    'Lockr',
    'struct/MapData',
    'helper/mapconvert',
    'cdn',
    'conf/colors',
    'conf/colorGroups',
    'conf/conf',
    'states/MapState'
], function (
    ACTION_TYPES,
    MAP_SIZE_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    utils,
    ready,
    Settings,
    twoMapData,
    eventQueue,
    Lockr,
    mapData,
    mapconvert,
    cdn,
    colors,
    colorGroups,
    conf,
    mapState
) {
    let renderingEnabled = false
    let highlights = {}
    let villageSize
    let villageMargin = 1
    let villageBlock
    let lineSize
    let blockOffset
    let allVillages
    let mappedData = {
        village: {},
        character: {},
        tribe: {}
    }
    let boundariesX = { a: 0, b: 0 }
    let boundariesY = { a: 0, b: 0 }
    let viewBoundariesX = { a: 0, b: 0 }
    let viewBoundariesY = { a: 0, b: 0 }
    let selectedVillage
    let currentPosition = {}
    let currentCoords = {}
    let mappedVillages = {}
    let hoveredVillage = false
    let hoveredVillageX
    let hoveredVillageY
    let $viewport
    let viewportContext
    let $viewportCache
    let viewportCacheContext
    let $viewportRef
    let viewportRefContext
    let $map
    let $mapWrapper
    let $player
    let playerId
    let playerTribeId
    let villageColors
    let tribeRelations
    let settings
    let minimapSettings
    const STORAGE_KEYS = {
        CACHE_VILLAGES: 'minimap_cache_villages',
        SETTINGS: 'minimap_settings'
    }
    const MAP_SIZES = {
        [MAP_SIZE_TYPES.VERY_SMALL]: 2,
        [MAP_SIZE_TYPES.SMALL]: 3,
        [MAP_SIZE_TYPES.BIG]: 5,
        [MAP_SIZE_TYPES.VERY_BIG]: 7
    }
    const INTERFACE_HEIGHT = 265
    const BORDER_PADDING = 10
    const BORDER_COLOR = '#2B4700'
    const colorService = injector.get('colorService')
    const spriteFactory = injector.get('spriteFactory')
    
    let allowJump = true
    let allowMove = false
    let dragStart = {}
    let highlightSprite
    let currentMouseCoords = {
        x: 0,
        y: 0
    }
    let firstDraw = true
    const rhexcolor = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

    /**
     * Calcule the coords from clicked position in the canvas.
     *
     * @param {Object} event - Canvas click event.
     * @return {Object} X and Y coordinates.
     */
    const getCoords = function (event) {
        let rawX = Math.ceil(currentPosition.x + event.offsetX) - blockOffset
        let rawY = Math.ceil(currentPosition.y + event.offsetY) + blockOffset

        if (Math.floor((rawY / villageBlock)) % 2) {
            rawX += blockOffset
        }

        rawX -= rawX % villageBlock
        rawY -= rawY % villageBlock

        return {
            x: Math.ceil((rawX - $viewport.width / 2) / villageBlock),
            y: Math.ceil((rawY - $viewport.height / 2) / villageBlock)
        }
    }

    /**
     * Convert pixel wide map position to coords
     *
     * @param {Number} x - X pixel position.
     * @param {Number} y - Y pixel position.
     * @return {Object} Y and Y coordinates.
     */
    const pixel2Tiles = function (x, y) {
        return {
            x: (x / conf.TILESIZE.x),
            y: (y / conf.TILESIZE.y / conf.TILESIZE.off)
        }
    }

    /**
     * Calculate the coords based on zoom.
     *
     * @param {Array[x, y, canvasW, canvasH]} rect - Coords and canvas size.
     * @param {Number} zoom - Current zoom used to display the game original map.
     * @return {Array} Calculated coords.
     */
    const convert = function (rect, zoom) {
        zoom = 1 / (zoom || 1)

        const xy = pixel2Tiles(rect[0] * zoom, rect[1] * zoom)
        const wh = pixel2Tiles(rect[2] * zoom, rect[3] * zoom)
        
        return [
            xy.x - 1,
            xy.y - 1,
            (wh.x + 3) || 1,
            (wh.y + 3) || 1
        ]
    }

    const drawBorders = function () {
        const binUrl = cdn.getPath(conf.getMapPath())
        const continentEnabled = minimapSettings[SETTINGS.SHOW_CONTINENT_DEMARCATIONS]
        const provinceEnabled = minimapSettings[SETTINGS.SHOW_PROVINCE_DEMARCATIONS]

        const drawContinent = function (x, y) {
            viewportCacheContext.fillStyle = minimapSettings[SETTINGS.COLOR_CONTINENT]
            viewportCacheContext.fillRect(x * villageBlock + blockOffset - 1, y * villageBlock + blockOffset - 1, 3, 1)
            viewportCacheContext.fillRect(x * villageBlock + blockOffset, y * villageBlock + blockOffset - 2, 1, 3)
        }

        const drawProvince = function (x, y) {
            viewportCacheContext.fillStyle = minimapSettings[SETTINGS.COLOR_PROVINCE]
            viewportCacheContext.fillRect(x * villageBlock + blockOffset, y * villageBlock + blockOffset - 1, 1, 1)
        }

        utils.xhrGet(binUrl, 'arraybuffer').then(function (xhr) {
            const dataView = new DataView(xhr.response)
            const paddedBoundariesX = {
                a: boundariesX.a - BORDER_PADDING,
                b: boundariesX.b + BORDER_PADDING
            }
            const paddedBoundariesY = {
                a: boundariesY.a - BORDER_PADDING,
                b: boundariesY.b + BORDER_PADDING
            }

            if (continentEnabled || provinceEnabled) {
                for (let x = paddedBoundariesX.a; x < paddedBoundariesX.b; x++) {
                    for (let y = paddedBoundariesY.a; y < paddedBoundariesY.b; y++) {
                        const tile = mapconvert.toTile(dataView, x, y)

                        // is border
                        if (tile.key.b) {
                            // is continental border
                            if (tile.key.c) {
                                if (continentEnabled) {
                                    drawContinent(x, y)
                                } else if (provinceEnabled) {
                                    drawProvince(x, y)
                                }
                            } else if (provinceEnabled) {
                                drawProvince(x, y)
                            }
                        }
                    }
                }
            }

            const borderX = paddedBoundariesX.a * villageBlock
            const borderY = paddedBoundariesY.a * villageBlock
            const borderWidth = (paddedBoundariesX.b - paddedBoundariesX.a) * villageBlock
            const borderHeight = (paddedBoundariesY.b - paddedBoundariesY.a) * villageBlock

            viewportCacheContext.beginPath()
            viewportCacheContext.lineWidth = 2
            viewportCacheContext.strokeStyle = BORDER_COLOR
            viewportCacheContext.rect(borderX, borderY, borderWidth, borderHeight)
            viewportCacheContext.stroke()
        })
    }

    const drawLoadedVillages = function () {
        drawVillages(allVillages)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    const drawViewport = function (pos) {
        viewportContext.drawImage($viewportCache, -pos.x, -pos.y)
    }

    const clearViewport = function () {
        viewportContext.clearRect(0, 0, $viewport.width, $viewport.height)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    const drawViewReference = function (pos) {
        const mapPosition = minimap.getMapPosition()
        const x = ((mapPosition.x - 2) * villageBlock) - pos.x
        const y = ((mapPosition.y - 2) * villageBlock) - pos.y

        // cross
        viewportRefContext.fillStyle = minimapSettings[SETTINGS.COLOR_VIEW_REFERENCE]
        viewportRefContext.fillRect(x, 0, 1, lineSize)
        viewportRefContext.fillRect(0, y, lineSize, 1)

        const mapRect = $mapWrapper.getBoundingClientRect()
        const refRectWidth = (mapRect.width / conf.TILESIZE.x / mapState.view.z) * villageBlock
        const refRectHeight = (mapRect.height / conf.TILESIZE.y / mapState.view.z) * villageBlock
        const refRectX = x - (refRectWidth / 2)
        const refRectY = y - (refRectHeight / 2)

        // view rect
        viewportRefContext.clearRect(refRectX, refRectY, refRectWidth, refRectHeight)
        viewportRefContext.beginPath()
        viewportRefContext.lineWidth = 1
        viewportRefContext.strokeStyle = minimapSettings[SETTINGS.COLOR_VIEW_REFERENCE]
        viewportRefContext.rect(refRectX, refRectY, refRectWidth, refRectHeight)
        viewportRefContext.stroke()
    }

    const clearCross = function () {
        viewportRefContext.clearRect(0, 0, $viewportRef.width, $viewportRef.height)
    }

    const renderStep = function () {
        if (renderingEnabled) {
            const pos = {
                x: currentPosition.x - ($viewport.width / 2),
                y: currentPosition.y - ($viewport.height / 2)
            }

            clearViewport()
            clearCross()
            drawViewport(pos)

            if (minimapSettings[SETTINGS.SHOW_VIEW_REFERENCE]) {
                drawViewReference(pos)
            }
        }

        window.requestAnimationFrame(renderStep)
    }

    const cacheVillages = function (villages) {
        for (let i = 0, l = villages.length; i < l; i++) {
            let v = villages[i]

            // meta village
            if (v.id < 0) {
                continue
            }

            if (!(v.x in mappedData.village)) {
                mappedData.village[v.x] = {}
            }

            if (!(v.x in mappedVillages)) {
                mappedVillages[v.x] = []
            }

            mappedData.village[v.x][v.y] = v.character_id || 0
            mappedVillages[v.x][v.y] = v

            if (v.character_id) {
                if (v.character_id in mappedData.character) {
                    mappedData.character[v.character_id].push([v.x, v.y])
                } else {
                    mappedData.character[v.character_id] = [[v.x, v.y]]
                }

                if (v.tribe_id) {
                    if (v.tribe_id in mappedData.tribe) {
                        mappedData.tribe[v.tribe_id].push(v.character_id)
                    } else {
                        mappedData.tribe[v.tribe_id] = [v.character_id]
                    }
                }
            }
        }
    }

    const setBoundaries = function () {
        let allX = []
        let allY = []

        for (let x in mappedData.village) {
            allX.push(x)

            for (let y in mappedData.village[x]) {
                allY.push(y)
            }
        }

        boundariesX.a = Math.min(...allX)
        boundariesX.b = Math.max(...allX)
        boundariesY.a = Math.min(...allY)
        boundariesY.b = Math.max(...allY)

        viewBoundariesX.a = boundariesX.a * villageBlock
        viewBoundariesX.b = boundariesX.b * villageBlock
        viewBoundariesY.a = boundariesY.a * villageBlock
        viewBoundariesY.b = boundariesY.b * villageBlock
    }

    const onHoverVillage = function (coords, event) {
        if (hoveredVillage) {
            if (hoveredVillageX === coords.x && hoveredVillageY === coords.y) {
                return false
            } else {
                onBlurVillage()
            }
        }

        hoveredVillage = true
        hoveredVillageX = coords.x
        hoveredVillageY = coords.y

        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_HOVER, {
            x: hoveredVillageX,
            y: hoveredVillageY,
            event: event
        })

        const pid = mappedData.village[hoveredVillageX][hoveredVillageY]

        if (pid) {
            highlightVillages(mappedData.character[pid])
        } else {
            highlightVillages([[hoveredVillageX, hoveredVillageY]])
        }
    }

    const onBlurVillage = function () {
        if (!hoveredVillage) {
            return false
        }

        const pid = mappedData.village[hoveredVillageX][hoveredVillageY]

        if (pid) {
            unhighlightVillages(mappedData.character[pid])
        } else {
            unhighlightVillages([[hoveredVillageX, hoveredVillageY]])
        }

        hoveredVillage = false
        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_BLUR, {
            x: hoveredVillageX,
            y: hoveredVillageY
        })
    }

    const highlightVillages = function (villages) {
        let villagesData = []

        for (let i = 0; i < villages.length; i++) {
            let x = villages[i][0]
            let y = villages[i][1]

            villagesData.push(mappedVillages[x][y])
        }

        drawVillages(villagesData, minimapSettings[SETTINGS.COLOR_QUICK_HIGHLIGHT])
    }

    const unhighlightVillages = function (villages) {
        let villagesData = []

        for (let i = 0; i < villages.length; i++) {
            let x = villages[i][0]
            let y = villages[i][1]

            villagesData.push(mappedVillages[x][y])
        }

        drawVillages(villagesData)
    }

    const showHighlightSprite = function (x, y) {
        let pos = mapService.tileCoordinate2Pixel(x, y)
        highlightSprite.setTranslation(pos[0] - 25, pos[1] + 2)
        highlightSprite.alpha = 1
    }

    const hideHighlightSprite = function () {
        highlightSprite.alpha = 0
    }

    const quickHighlight = function (x, y) {
        mapData.getTownAtAsync(x, y, function (village) {
            if (!village) {
                return false
            }

            switch (minimapSettings[SETTINGS.RIGHT_CLICK_ACTION]) {
                case ACTION_TYPES.HIGHLIGHT_PLAYER: {
                    if (!village.character_id) {
                        return false
                    }

                    minimap.addHighlight({
                        type: 'character',
                        id: village.character_id
                    }, colors.palette.flat().random())

                    break
                }
                case ACTION_TYPES.HIGHLIGHT_TRIBE: {
                    if (!village.tribe_id) {
                        return false
                    }

                    minimap.addHighlight({
                        type: 'tribe',
                        id: village.tribe_id
                    }, colors.palette.flat().random())

                    break
                }
            }
        })
    }

    const getVillageColor = function (village) {
        if (minimapSettings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
            if (village.character_id in highlights.character) {
                return highlights.character[village.character_id]
            } else if (village.tribe_id in highlights.tribe) {
                return highlights.tribe[village.tribe_id]
            }

            return false
        }

        if (!village.character_id) {
            if (minimapSettings[SETTINGS.SHOW_BARBARIANS]) {
                return villageColors.barbarian
            }

            return false
        }

        if (village.character_id === playerId) {
            if (village.id === selectedVillage.getId() && minimapSettings[SETTINGS.HIGHLIGHT_SELECTED]) {
                return villageColors.selected
            } else if (village.character_id in highlights.character) {
                return highlights.character[village.character_id]
            } else if (minimapSettings[SETTINGS.HIGHLIGHT_OWN]) {
                return villageColors.player
            }
        } else if (village.character_id in highlights.character) {
            return highlights.character[village.character_id]
        } else if (village.tribe_id in highlights.tribe) {
            return highlights.tribe[village.tribe_id]
        } else if (playerTribeId && playerTribeId === village.tribe_id && minimapSettings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
            return villageColors.tribe
        } else if (tribeRelations && minimapSettings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
            if (tribeRelations.isAlly(village.tribe_id)) {
                return villageColors.ally
            } else if (tribeRelations.isEnemy(village.tribe_id)) {
                return villageColors.enemy
            } else if (tribeRelations.isNAP(village.tribe_id)) {
                return villageColors.friendly
            }
        }

        return villageColors.ugly
    }

    const drawVillages = function (villages, predefinedColor) {
        for (let i = 0; i < villages.length; i++) {
            const village = villages[i]

            // meta village
            if (village.id < 0) {
                continue
            }

            const color = predefinedColor || getVillageColor(village)

            if (!color) {
                continue
            }

            const x = village.x * villageBlock + (village.y % 2 ? blockOffset : 0)
            const y = village.y * villageBlock

            viewportCacheContext.fillStyle = color
            viewportCacheContext.fillRect(x, y, villageSize, villageSize)
        }
    }

    const updateMinimapValues = function () {
        villageSize = MAP_SIZES[minimapSettings[SETTINGS.MAP_SIZE]]
        blockOffset = Math.round(villageSize / 2)
        villageBlock = villageSize + villageMargin
        lineSize = villageBlock * 1000
        
        viewBoundariesX.a = boundariesX.a * villageBlock
        viewBoundariesX.b = boundariesX.b * villageBlock
        viewBoundariesY.a = boundariesY.a * villageBlock
        viewBoundariesY.b = boundariesY.b * villageBlock

        $viewportCache.width = 1000 * villageBlock
        $viewportCache.height = 1000 * villageBlock
        viewportCacheContext.imageSmoothingEnabled = false
    }

    const setViewportSize = function () {
        const WIDTH = 686
        const HEIGHT = document.body.clientHeight - INTERFACE_HEIGHT

        $viewport.width = WIDTH
        $viewport.height = HEIGHT
        $viewportRef.width = WIDTH
        $viewportRef.height = HEIGHT

        viewportContext.imageSmoothingEnabled = false
        viewportRefContext.imageSmoothingEnabled = false
    }

    const eventHandlers = {
        onViewportRefMouseDown: function (event) {
            event.preventDefault()

            allowJump = true
            allowMove = true
            dragStart.x = currentPosition.x + event.pageX
            dragStart.y = currentPosition.y + event.pageY

            if (hoveredVillage) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_CLICK, [
                    hoveredVillageX,
                    hoveredVillageY,
                    event
                ])

                // right click
                if (event.which === 3) {
                    quickHighlight(hoveredVillageX, hoveredVillageY)
                }
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_START_MOVE)
        },
        onViewportRefMouseUp: function () {
            allowMove = false
            dragStart = {}

            if (!allowJump) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_STOP_MOVE)
            }
        },
        onViewportRefMouseMove: function (event) {
            allowJump = false
            currentMouseCoords = getCoords(event)

            if (allowMove) {
                currentPosition.x = (dragStart.x - event.pageX).bound(viewBoundariesX.a, viewBoundariesX.b)
                currentPosition.y = (dragStart.y - event.pageY).bound(viewBoundariesY.a, viewBoundariesY.b)
                currentCoords.x = currentMouseCoords.x
                currentCoords.y = currentMouseCoords.y
                return false
            }

            if (currentCoords.x !== currentMouseCoords.x || currentCoords.y !== currentMouseCoords.y) {
                hideHighlightSprite()
                showHighlightSprite(currentMouseCoords.x, currentMouseCoords.y)
            }

            if (currentMouseCoords.x in mappedVillages && currentMouseCoords.y in mappedVillages[currentMouseCoords.x]) {
                let village = mappedVillages[currentMouseCoords.x][currentMouseCoords.y]

                // ignore barbarian villages
                if (!minimapSettings[SETTINGS.SHOW_BARBARIANS] && !village.character_id) {
                    return false
                }

                // check if the village is custom highlighted
                if (minimapSettings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                    let highlighted = false

                    if (village.character_id in highlights.character) {
                        highlighted = true
                    } else if (village.tribe_id in highlights.tribe) {
                        highlighted = true
                    }

                    if (!highlighted) {
                        return false
                    }
                }

                return onHoverVillage(currentMouseCoords, event)
            }

            onBlurVillage()
        },
        onViewportRefMouseLeave: function () {
            if (hoveredVillage) {
                onBlurVillage()
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_MOUSE_LEAVE)
        },
        onViewportRefMouseClick: function (event) {
            if (!allowJump) {
                return false
            }

            const coords = getCoords(event)
            mapService.jumpToVillage(coords.x, coords.y)
        },
        onViewportRefMouseContext: function (event) {
            event.preventDefault()
            return false
        },
        onHighlightChange: function () {
            highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
            highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}

            drawLoadedVillages()
        },
        onSelectedVillageChange: function () {
            const old = {
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }

            selectedVillage = $player.getSelectedVillage()

            drawVillages([{
                character_id: $player.getId(),
                id: old.id,
                x: old.x,
                y: old.y
            }, {
                character_id: $player.getId(),
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }])
        }
    }

    let minimap = {}

    /**
     * @param {Object} item - Highlight item.
     * @param {String} item.type - player or tribe
     * @param {String} item.id - player/tribe id
     * @param {String} color - Hex color
     *
     * @return {Boolean} true if successfully added
     */
    minimap.addHighlight = function (item, color) {
        if (!item || !item.type || !item.id || !hasOwn.call(highlights, item.type)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY)
            return false
        }

        if (!rhexcolor.test(color)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR)
            return false
        }

        highlights[item.type][item.id] = color[0] !== '#' ? '#' + color : color
        const colorGroup = item.type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
        colorService.setCustomColorsByGroup(colorGroup, highlights[item.type])
        $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)

        drawLoadedVillages()

        return true
    }

    minimap.removeHighlight = function (type, itemId) {
        if (typeof itemId === 'undefined' || !hasOwn.call(highlights, type)) {
            return false
        }

        if (!hasOwn.call(highlights[type], itemId)) {
            return false
        }

        delete highlights[type][itemId]
        const colorGroup = type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
        colorService.setCustomColorsByGroup(colorGroup, highlights[type])
        $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)
        drawLoadedVillages()

        return true
    }

    minimap.getHighlight = function (type, item) {
        if (hasOwn.call(highlights[type], item)) {
            return highlights[type][item]
        } else {
            return false
        }
    }

    minimap.getHighlights = function () {
        return highlights
    }

    minimap.eachHighlight = function (callback) {
        for (let type in highlights) {
            for (let id in highlights[type]) {
                callback(type, id, highlights[type][id])
            }
        }
    }

    minimap.setViewport = function (element) {
        $viewport = element
        $viewport.style.background = minimapSettings[SETTINGS.COLOR_BACKGROUND]
        viewportContext = $viewport.getContext('2d')
    }

    minimap.setViewportRef = function (element) {
        $viewportRef = element
        viewportRefContext = $viewportRef.getContext('2d')
    }

    minimap.setCurrentPosition = function (x, y) {
        currentPosition.x = (x * villageBlock)
        currentPosition.y = (y * villageBlock)
        currentCoords.x = Math.ceil(x)
        currentCoords.y = Math.ceil(y)
    }

    /**
     * @return {Array}
     */
    minimap.getMapPosition = function () {
        if (!$map.width || !$map.height) {
            return false
        }

        let view = mapData.getMap().engine.getView()
        let converted = convert([
            -view.x,
            -view.y,
            $map.width / 2,
            $map.height / 2
        ], view.z)

        return {
            x: converted[0] + converted[2],
            y: converted[1] + converted[3]
        }
    }

    minimap.getSettings = function () {
        return settings
    }

    minimap.drawMinimap = function () {
        if (firstDraw) {
            firstDraw = false
        }

        $viewport.style.background = minimapSettings[SETTINGS.COLOR_BACKGROUND]
        viewportCacheContext.clearRect(0, 0, $viewportCache.width, $viewportCache.height)

        ready(function () {
            drawBorders()
            drawLoadedVillages()
        }, 'minimap_data')
    }

    minimap.enableRendering = function enableRendering () {
        renderingEnabled = true
    }

    minimap.disableRendering = function disableRendering () {
        renderingEnabled = false
    }

    minimap.isFirstDraw = function () {
        return !!firstDraw
    }

    minimap.init = function () {
        minimap.initialized = true
        $viewportCache = document.createElement('canvas')
        viewportCacheContext = $viewportCache.getContext('2d')
        highlightSprite = spriteFactory.make('hover')
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            minimapSettings = settings.getAll()
            updateMinimapValues()

            if (updates[UPDATES.MAP_POSITION]) {
                minimap.setCurrentPosition(currentCoords.x, currentCoords.y)
            }

            if (updates[UPDATES.MINIMAP]) {
                minimap.drawMinimap()
            }
        })

        minimapSettings = settings.getAll()
        highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
        highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}
        updateMinimapValues()
    }

    minimap.run = function () {
        ready(function () {
            $mapWrapper = document.getElementById('map')
            $map = document.getElementById('main-canvas')
            $player = modelDataService.getSelectedCharacter()
            tribeRelations = $player.getTribeRelations()
            playerId = $player.getId()
            playerTribeId = $player.getTribeId()
            villageColors = $player.getVillagesColors()

            highlightSprite.alpha = 0
            mapState.graph.layers.effects.push(highlightSprite)

            setViewportSize()

            selectedVillage = $player.getSelectedVillage()
            currentCoords.x = selectedVillage.getX()
            currentCoords.y = selectedVillage.getY()
            currentPosition.x = selectedVillage.getX() * villageBlock
            currentPosition.y = selectedVillage.getY() * villageBlock

            window.addEventListener('resize', setViewportSize, false)
            $viewportRef.addEventListener('mousedown', eventHandlers.onViewportRefMouseDown)
            $viewportRef.addEventListener('mouseup', eventHandlers.onViewportRefMouseUp)
            $viewportRef.addEventListener('mousemove', eventHandlers.onViewportRefMouseMove)
            $viewportRef.addEventListener('mouseleave', eventHandlers.onViewportRefMouseLeave)
            $viewportRef.addEventListener('click', eventHandlers.onViewportRefMouseClick)
            $viewportRef.addEventListener('contextmenu', eventHandlers.onViewportRefMouseContext)

            twoMapData.load(function () {
                allVillages = twoMapData.getVillages()
                cacheVillages(allVillages)
                setBoundaries()
                renderStep()

                $rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.onSelectedVillageChange)
                $rootScope.$on(eventTypeProvider.TRIBE_RELATION_CHANGED, drawLoadedVillages)
                $rootScope.$on(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.onHighlightChange)
            })
        }, ['initial_village', 'tribe_relations'])
    }

    return minimap
})

define('two/minimap/events', [], function () {
    angular.extend(eventTypeProvider, {
        MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS: 'minimap_highlight_add_error_exists',
        MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY: 'minimap_highlight_add_error_no_entry',
        MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR: 'minimap_highlight_add_error_invalid_color',
        MINIMAP_VILLAGE_CLICK: 'minimap_village_click',
        MINIMAP_VILLAGE_HOVER: 'minimap_village_hover',
        MINIMAP_VILLAGE_BLUR: 'minimap_village_blur',
        MINIMAP_MOUSE_LEAVE: 'minimap_mouse_leave',
        MINIMAP_START_MOVE: 'minimap_start_move',
        MINIMAP_STOP_MOVE: 'minimap_stop_move',
        MINIMAP_AREA_LOADED: 'minimap_area_loaded'
    })
})

define('two/minimap/ui', [
    'two/ui',
    'two/minimap',
    'two/minimap/types/actions',
    'two/minimap/types/mapSizes',
    'two/minimap/settings',
    'two/minimap/settings/map',
    'two/utils',
    'two/EventScope',
    'two/Settings',
    'helper/util',
    'struct/MapData',
    'cdn',
    'conf/colors'
], function (
    interfaceOverflow,
    minimap,
    ACTION_TYPES,
    MAP_SIZE_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    utils,
    EventScope,
    Settings,
    util,
    mapData,
    cdn,
    colors
) {
    let $scope
    let $button
    let $minimapCanvas
    let $viewportRefCanvas
    let $minimapContainer
    let MapController
    let windowWrapper
    let mapWrapper
    let tooltipWrapper
    let tooltipQueue = {}
    let allowTooltip = false
    let currentVillageHash
    let highlightNames = {
        character: {},
        tribe: {}
    }
    let settings
    const TAB_TYPES = {
        MINIMAP: 'minimap',
        HIGHLIGHTS: 'highlights',
        SETTINGS: 'settings'
    }
    const DEFAULT_TAB = TAB_TYPES.MINIMAP

    const selectTab = function (tab) {
        $scope.selectedTab = tab

        if (tab === TAB_TYPES.MINIMAP) {
            minimap.enableRendering()
        } else {
            minimap.disableRendering()
        }
    }

    const appendCanvas = function () {
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($viewportRefCanvas)
    }

    const getTribeData = function (data, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: data.id
        }, callback)
    }
    
    const getCharacterData = function (data, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: data.id
        }, callback)
    }

    const updateHighlightNames = function () {
        Object.keys($scope.highlights.character).forEach(function (id) {
            if (id in highlightNames.character) {
                return
            }

            getCharacterData({
                id: id
            }, function (data) {
                highlightNames.character[id] = data.character_name
            })
        })

        Object.keys($scope.highlights.tribe).forEach(function (id) {
            if (id in highlightNames.tribe) {
                return
            }

            getTribeData({
                id: id
            }, function (data) {
                highlightNames.tribe[id] = data.name
            })
        })
    }

    const loadVillageData = function (x, y) {
        return new Promise(function (resolve) {
            let village = mapData.getTownAt(x, y)

            if (village) {
                return resolve(village)
            }

            mapData.loadTownDataAsync(x, y, 1, 1, function (village) {
                resolve(village)
            })
        })
    }

    const genVillageHash = function (x, y) {
        return String(x) + String(y)
    }

    const showTooltip = function (event, data) {
        if (!tooltipWrapper) {
            return
        }

        let villageHash = genVillageHash(data.x, data.y)
        currentVillageHash = villageHash
        tooltipQueue[villageHash] = true
        allowTooltip = true

        loadVillageData(data.x, data.y).then(function (village) {
            if (!tooltipQueue[genVillageHash(village.x, village.y)]) {
                return
            }

            if (!allowTooltip) {
                return
            }

            windowWrapper.appendChild(tooltipWrapper)
            tooltipWrapper.classList.remove('ng-hide')

            MapController.tt.name = village.name
            MapController.tt.x = village.x
            MapController.tt.y = village.y
            MapController.tt.province_name = village.province_name
            MapController.tt.points = village.points
            MapController.tt.character_name = village.character_name || '-'
            MapController.tt.character_points = village.character_points || 0
            MapController.tt.tribe_name = village.tribe_name || '-'
            MapController.tt.tribe_tag = village.tribe_tag || '-'
            MapController.tt.tribe_points = village.tribe_points || 0
            MapController.tt.morale = village.morale || 0
            MapController.tt.position = {}
            MapController.tt.position.x = data.event.pageX + 50
            MapController.tt.position.y = data.event.pageY + 50
            MapController.tt.visible = true

            const tooltipOffset = tooltipWrapper.getBoundingClientRect()
            const windowOffset = windowWrapper.getBoundingClientRect()
            const tooltipWrapperSpacerX = tooltipOffset.width + 50
            const tooltipWrapperSpacerY = tooltipOffset.height + 50

            const onTop = MapController.tt.position.y + tooltipWrapperSpacerY > windowOffset.top + windowOffset.height
            const onLeft = MapController.tt.position.x + tooltipWrapperSpacerX > windowOffset.width

            if (onTop) {
                MapController.tt.position.y -= 50
            }

            tooltipWrapper.classList.toggle('left', onLeft)
            tooltipWrapper.classList.toggle('top', onTop)
        })
    }

    const hideTooltip = function (event, coords) {
        if (!tooltipWrapper) {
            return
        }

        let villageHash = coords ? genVillageHash(coords) : currentVillageHash
        tooltipQueue[villageHash] = false
        allowTooltip = false
        MapController.tt.visible = false
        tooltipWrapper.classList.add('ng-hide')
        mapWrapper.appendChild(tooltipWrapper)
    }

    const openColorPalette = function (inputType, colorGroup, itemId) {
        let modalScope = $rootScope.$new()
        let selectedColor
        let hideReset = true
        let settingId

        modalScope.colorPalettes = colors.palette

        if (inputType === 'setting') {
            settingId = colorGroup
            selectedColor = settings.get(settingId)
            hideReset = false

            modalScope.submit = function () {
                $scope.settings[settingId] = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }

            modalScope.reset = function () {
                $scope.settings[settingId] = settings.getDefault(settingId)
                modalScope.closeWindow()
            }
        } else if (inputType === 'add_custom_highlight') {
            selectedColor = $scope.addHighlightColor

            modalScope.submit = function () {
                $scope.addHighlightColor = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }
        } else if (inputType === 'edit_custom_highlight') {
            selectedColor = $scope.highlights[colorGroup][itemId]

            modalScope.submit = function () {
                minimap.addHighlight({
                    id: itemId,
                    type: colorGroup
                }, modalScope.selectedColor)
                modalScope.closeWindow()
            }
        }

        modalScope.selectedColor = selectedColor.replace('#', '')
        modalScope.hasCustomColors = true
        modalScope.hideReset = hideReset

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    const addCustomHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.addHighlightColor)
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'minimap'))
    }

    const resetSettings = function () {
        let modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('reset_confirm_title', $rootScope.loc.ale, 'minimap')
        modalScope.text = $filter('i18n')('reset_confirm_text', $rootScope.loc.ale, 'minimap')
        modalScope.submitText = $filter('i18n')('reset', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.showQuestionMarkIcon = true
        modalScope.switchColors = true

        modalScope.submit = function submit() {
            settings.resetAll()
            utils.notif('success', $filter('i18n')('settings_reset', $rootScope.loc.ale, 'minimap'))
            modalScope.closeWindow()
        }

        modalScope.cancel = function cancel() {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    const highlightsCount = function () {
        const character = Object.keys($scope.highlights.character).length
        const tribe = Object.keys($scope.highlights.tribe).length
        
        return character + tribe
    }

    const openProfile = function (type, itemId) {
        const handler = type === 'character'
            ? windowDisplayService.openCharacterProfile
            : windowDisplayService.openTribeProfile

        handler(itemId)
    }

    const eventHandlers = {
        addHighlightAutoCompleteSelect: function (item) {
            $scope.selectedHighlight = {
                id: item.id,
                type: item.type,
                name: item.name
            }
        },
        highlightUpdate: function () {
            updateHighlightNames()
        },
        highlightAddErrorExists: function () {
            utils.notif('error', $filter('i18n')('highlight_add_error_exists', $rootScope.loc.ale, 'minimap'))
        },
        highlightAddErrorNoEntry: function () {
            utils.notif('error', $filter('i18n')('highlight_add_error_no_entry', $rootScope.loc.ale, 'minimap'))
        },
        highlightAddErrorInvalidColor: function () {
            utils.notif('error', $filter('i18n')('highlight_add_error_invalid_color', $rootScope.loc.ale, 'minimap'))
        },
        onMouseLeaveMinimap: function () {
            hideTooltip()

            $viewportRefCanvas.dispatchEvent(new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true
            }))
        },
        onMouseMoveMinimap: function () {
            hideTooltip()

            $viewportRefCanvas.style.cursor = 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move'
        },
        onMouseStopMoveMinimap: function () {
            $viewportRefCanvas.style.cursor = ''
        }
    }

    const init = function () {
        settings = minimap.getSettings()
        MapController = transferredSharedDataService.getSharedData('MapController')
        $minimapCanvas = document.createElement('canvas')
        $minimapCanvas.className = 'minimap'
        $viewportRefCanvas = document.createElement('canvas')
        $viewportRefCanvas.className = 'cross'

        minimap.setViewport($minimapCanvas)
        minimap.setViewportRef($viewportRefCanvas)

        tooltipWrapper = document.querySelector('#map-tooltip')
        windowWrapper = document.querySelector('#wrapper')
        mapWrapper = document.querySelector('#map')

        $button = interfaceOverflow.addMenuButton('Minimapa', 50)
        $button.addEventListener('click', function () {
            const current = minimap.getMapPosition()

            if (!current) {
                return false
            }

            buildWindow()
            minimap.setCurrentPosition(current.x, current.y)
        })

        interfaceOverflow.addTemplate('twoverflow_minimap_window', `<div id=\"two-minimap\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Minimapa</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main small-select\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.MINIMAP)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.MINIMAP}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.MINIMAP}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.MINIMAP}\">{{ 'minimap' | i18n:loc.ale:'minimap' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.HIGHLIGHTS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.HIGHLIGHTS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.HIGHLIGHTS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.HIGHLIGHTS}\">{{ 'highlights' | i18n:loc.ale:'minimap' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ 'settings' | i18n:loc.ale:'common' }}</a></div></div></div></div></div><div ng-show=\"selectedTab === TAB_TYPES.MINIMAP\" class=\"minimap-container\"></div><div class=\"box-paper\" ng-class=\"{'footer': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"scroll-wrap\"><div ng-show=\"selectedTab == TAB_TYPES.HIGHLIGHTS\"><h5 class=\"twx-section\">{{ 'add' | i18n:loc.ale:'minimap' }}</h5><table class=\"tbl-border-light tbl-striped add-highlight\"><col width=\"40%\"><col><col width=\"4%\"><col width=\"4%\"><tr><td><div auto-complete=\"autoComplete\"></div><td class=\"text-center\"><span ng-show=\"selectedHighlight\" class=\"icon-26x26-rte-{{ selectedHighlight.type }}\"></span> {{ selectedHighlight.name }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('add_custom_highlight')\" ng-style=\"{'background-color': addHighlightColor }\" tooltip=\"\" tooltip-content=\"{{ 'tooltip_pick_color' | i18n:loc.ale:'minimap' }}\"></div><td><span class=\"btn-orange icon-26x26-plus\" ng-click=\"addCustomHighlight()\" tooltip=\"\" tooltip-content=\"{{ 'add' | i18n:loc.ale:'minimap' }}\"></span></table><h5 class=\"twx-section\">{{ TAB_TYPES.HIGHLIGHTS | i18n:loc.ale:'minimap' }}</h5><p class=\"text-center\" ng-show=\"!highlightsCount()\">{{ 'no_highlights' | i18n:loc.ale:'minimap' }}<table class=\"highlights tbl-border-light tbl-striped\" ng-show=\"highlightsCount()\"><col width=\"4%\"><col><col width=\"4%\"><col width=\"4%\"><tr ng-repeat=\"(id, color) in highlights.character\"><td><span class=\"icon-26x26-rte-character\"></span><td><span class=\"open-profile\" ng-click=\"openProfile('character', id)\">{{ highlightNames.character[id] }}</span><td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('edit_custom_highlight', 'character', id)\" ng-style=\"{'background-color': color }\"></div><td><a class=\"size-26x26 btn-red icon-20x20-close\" ng-click=\"removeHighlight('character', id)\" tooltip=\"\" tooltip-content=\"{{ 'remove' | i18n:loc.ale:'minimap' }}\"></a><tr ng-repeat=\"(id, color) in highlights.tribe\"><td><span class=\"icon-26x26-rte-tribe\"></span><td><span class=\"open-profile\" ng-click=\"openProfile('tribe', id)\">{{ highlightNames.tribe[id] }}</span><td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('edit_custom_highlight', 'tribe', id)\" ng-style=\"{'background-color': color }\"></div><td><a class=\"size-26x26 btn-red icon-20x20-close\" ng-click=\"removeHighlight('tribe', id)\" tooltip=\"\" tooltip-content=\"{{ 'remove' | i18n:loc.ale:'minimap' }}\"></a></table></div><div class=\"settings\" ng-show=\"selectedTab == TAB_TYPES.SETTINGS\"><table class=\"tbl-border-light tbl-striped\"><col width=\"60%\"><col><col width=\"56px\"><tr><th colspan=\"3\">{{ 'misc' | i18n:loc.ale:'minimap' }}<tr><td>{{ 'settings_map_size' | i18n:loc.ale:'minimap' }}<td colspan=\"3\"><div select=\"\" list=\"mapSizes\" selected=\"settings[SETTINGS.MAP_SIZE]\" drop-down=\"true\"></div><tr><td>{{ 'settings_right_click_action' | i18n:loc.ale:'minimap' }}<td colspan=\"3\"><div select=\"\" list=\"actionTypes\" selected=\"settings[SETTINGS.RIGHT_CLICK_ACTION]\" drop-down=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_view_reference' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_VIEW_REFERENCE]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_continent_demarcations' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_CONTINENT_DEMARCATIONS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_province_demarcations' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_PROVINCE_DEMARCATIONS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_barbarians' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_BARBARIANS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_only_custom_highlights' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_highlight_own' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.HIGHLIGHT_OWN]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_highlight_selected' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.HIGHLIGHT_SELECTED]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_highlight_diplomacy' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.HIGHLIGHT_DIPLOMACY]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div></table><table class=\"tbl-border-light tbl-striped\"><col><col width=\"29px\"><tr><th colspan=\"2\">{{ 'colors_misc' | i18n:loc.ale:'minimap' }}<tr><td>{{ 'settings_colors_background' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_BACKGROUND)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_BACKGROUND] }\"></div><tr><td>{{ 'settings_colors_province' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_PROVINCE)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_PROVINCE] }\"></div><tr><td>{{ 'settings_colors_continent' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_CONTINENT)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_CONTINENT] }\"></div><tr><td>{{ 'settings_colors_view_reference' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_VIEW_REFERENCE)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_VIEW_REFERENCE] }\"></div><tr><td>{{ 'settings_colors_quick_highlight' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_QUICK_HIGHLIGHT)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_QUICK_HIGHLIGHT] }\"></div></table><p class=\"text-center\">{{ 'default_village_colors_info'| i18n:loc.ale:'minimap' }}</div></div></div></div><footer class=\"win-foot\" ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"resetSettings()\">{{ 'reset' | i18n:loc.ale:'common' }}</a><li><a href=\"#\" class=\"btn-border btn-green\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#map-tooltip{z-index:1000}#two-minimap .minimap{position:absolute;left:0;top:38px;z-index:5}#two-minimap .cross{position:absolute;left:0;top:38px;z-index:6}#two-minimap .box-paper:not(.footer) .scroll-wrap{margin-bottom:40px}#two-minimap span.select-wrapper{width:100%}#two-minimap .add-highlight input{width:100%}#two-minimap .open-profile{font-weight:500;color:#5d3b17;padding:0 5px}#two-minimap .open-profile:hover{text-shadow:-1px 1px 0 #e0cc97}#two-minimap .settings td:first-child{padding:0 5px}#two-minimap .highlights .color-container{margin:1px}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.addHighlightColor = '#000000'
        $scope.highlights = minimap.getHighlights()
        $scope.highlightNames = highlightNames
        $scope.mapSizes = Settings.encodeList(MAP_SIZE_TYPES, {
            textObject: 'minimap',
            disabled: false
        })
        $scope.actionTypes = Settings.encodeList(ACTION_TYPES, {
            textObject: 'minimap',
            disabled: false
        })
        $scope.autoComplete = {
            type: ['character', 'tribe'],
            placeholder: $filter('i18n')('placeholder_search', $rootScope.loc.ale, 'minimap'),
            onEnter: eventHandlers.addHighlightAutoCompleteSelect
        }

        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addCustomHighlight = addCustomHighlight
        $scope.removeHighlight = minimap.removeHighlight
        $scope.saveSettings = saveSettings
        $scope.resetSettings = resetSettings
        $scope.highlightsCount = highlightsCount
        $scope.openProfile = openProfile

        settings.injectScope($scope, {
            textObject: 'minimap'
        })

        let eventScope = new EventScope('twoverflow_minimap_window', function onClose () {
            minimap.disableRendering()
        })

        eventScope.register(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.highlightUpdate, true)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS, eventHandlers.highlightAddErrorExists)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY, eventHandlers.highlightAddErrorNoEntry)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR, eventHandlers.highlightAddErrorInvalidColor)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_HOVER, showTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_BLUR, hideTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_MOUSE_LEAVE, eventHandlers.onMouseLeaveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_START_MOVE, eventHandlers.onMouseMoveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_STOP_MOVE, eventHandlers.onMouseStopMoveMinimap)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_minimap_window', $scope)
        updateHighlightNames()
        appendCanvas()
        minimap.enableRendering()

        if (minimap.isFirstDraw()) {
            minimap.drawMinimap()
        }
    }

    return init
})

define('two/minimap/settings', [], function () {
    return {
        MAP_SIZE: 'map_size',
        RIGHT_CLICK_ACTION: 'right_click_action',
        FLOATING_MINIMAP: 'floating_minimap',
        SHOW_VIEW_REFERENCE: 'show_view_reference',
        SHOW_CONTINENT_DEMARCATIONS: 'show_continent_demarcations',
        SHOW_PROVINCE_DEMARCATIONS: 'show_province_demarcations',
        SHOW_BARBARIANS: 'show_barbarians',
        SHOW_ONLY_CUSTOM_HIGHLIGHTS: 'show_only_custom_highlights',
        HIGHLIGHT_OWN: 'highlight_own',
        HIGHLIGHT_SELECTED: 'highlight_selected',
        HIGHLIGHT_DIPLOMACY: 'highlight_diplomacy',
        COLOR_GHOST: 'color_ghost',
        COLOR_QUICK_HIGHLIGHT: 'color_quick_highlight',
        COLOR_BACKGROUND: 'color_background',
        COLOR_PROVINCE: 'color_province',
        COLOR_CONTINENT: 'color_continent',
        COLOR_VIEW_REFERENCE: 'color_view_reference'
    }
})

define('two/minimap/settings/updates', function () {
    return {
        MINIMAP: 'minimap',
        MAP_POSITION: 'map_position'
    }
})

define('two/minimap/settings/map', [
    'two/minimap/settings',
    'two/minimap/types/actions',
    'two/minimap/types/mapSizes',
    'two/minimap/settings/updates'
], function (
    SETTINGS,
    ACTION_TYPES,
    MAP_SIZES,
    UPDATES
) {
    return {
        [SETTINGS.MAP_SIZE]: {
            default: MAP_SIZES.SMALL,
            inputType: 'select',
            updates: [UPDATES.MINIMAP, UPDATES.MAP_POSITION],
            disabledOption: false
        },
        [SETTINGS.RIGHT_CLICK_ACTION]: {
            default: ACTION_TYPES.HIGHLIGHT_PLAYER,
            inputType: 'select',
            disabledOption: false
        },
        [SETTINGS.SHOW_VIEW_REFERENCE]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_CONTINENT_DEMARCATIONS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_PROVINCE_DEMARCATIONS]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_BARBARIANS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_OWN]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_SELECTED]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_DIPLOMACY]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_SELECTED]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_BARBARIAN]: {
            default: '#969696',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_PLAYER]: {
            default: '#f0c800',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_QUICK_HIGHLIGHT]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_BACKGROUND]: {
            default: '#436213',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_PROVINCE]: {
            default: '#74c374',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_CONTINENT]: {
            default: '#74c374',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_VIEW_REFERENCE]: {
            default: '#999999',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_TRIBE]: {
            default: '#0000DB',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_ALLY]: {
            default: '#00a0f4',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_ENEMY]: {
            default: '#ED1212',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_FRIENDLY]: {
            default: '#BF4DA4',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_GHOST]: {
            default: '#3E551C',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        }
    }
})

define('two/minimap/types/actions', [], function () {
    return {
        HIGHLIGHT_PLAYER: 'highlight_player',
        HIGHLIGHT_TRIBE: 'highlight_tribe'
    }
})

define('two/minimap/types/mapSizes', [], function () {
    return {
        VERY_SMALL: 'very_small',
        SMALL: 'small',
        BIG: 'big',
        VERY_BIG: 'very_big'
    }
})

require([
    'two/ready',
    'two/minimap',
    'two/minimap/ui',
    'two/minimap/events',
    'two/minimap/types/actions',
    'two/minimap/settings',
    'two/minimap/settings/updates',
    'two/minimap/settings/map'
], function (
    ready,
    minimap,
    minimapInterface
) {
    if (minimap.initialized) {
        return false
    }

    ready(function () {
        minimap.init()
        minimapInterface()
        minimap.run()
    }, 'map')
})

})(this)
