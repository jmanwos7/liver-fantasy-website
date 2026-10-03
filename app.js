const leagueId = "1313376068006088704";
const simulations = 10000;

const leagueHistory = [
    {
        season: 2022,
        leagueId: "842523193431408640"
    },
    {
        season: 2023,
        leagueId: "916267053294698496"
    },
    {
        season: 2024,
        leagueId: "1048384174035439616"
    },
    {
        season: 2025,
        leagueId: "1181733392779878400"
    },
    {
        season: 2026,
        leagueId: "1313376068006088704"
    }
];

let league;
let users = [];
let rosters = [];
let matchups = [];
let projections = [];
let headToHeadRecords = {};
let remainingMatchups = {};
let seasonHistory = {};


/* ================================
   MANAGER USERNAME MAPPING

   These are the permanent/current
   usernames for each manager.

   Historical names and Sleeper
   display names are normalized to
   these usernames so old data stays
   attached to the correct person.
================================ */

const managerAliases = {

    zachmotil: "Zachmotil16",
    zachmotil16: "Zachmotil16",

    danny: "Danny4200",
    danny4200: "Danny4200",

    aidan: "Aidan82",
    aidan82: "Aidan82",

    holtz: "Holtzy81",
    holtzy81: "Holtzy81",

    spanky: "Spanky20025",
    spanky20025: "Spanky20025",

    nickwast: "nickwast16",
    nickwast16: "nickwast16",

    rowan: "RowanAlexander",
    rowanalexander: "RowanAlexander",
    hypefallz: "RowanAlexander",

    tomster: "tomsterdamonste",
    tomsterdamonste: "tomsterdamonste",

    zachridilla: "zachridilla",
    jmanwos: "jmanwos",
    grecko: "grecko",
    ben: "ben"

};


/*
    Convert any known old username,
    display name or nickname into the
    correct permanent username.
*/

function normalizeManager(username) {

    if (!username) {
        return "";
    }

    const key =
        String(username)
            .trim()
            .toLowerCase();

    return (
        managerAliases[key] ||
        String(username).trim()
    );

}


/*
    Get the actual Sleeper username when
    available, then normalize it.

    Sleeper can provide both username and
    display_name, so we check username first.
*/

function getManagerUsername(user) {

    if (!user) {
        return "";
    }

    const username =
        user.username ||
        user.display_name ||
        "";

    return normalizeManager(username);

}


/* ================================
   SEASON SETTINGS
================================ */

let currentSeason = 2026;
let currentWeek = 4;

const regularSeasonEndWeek = 14;
const playoffStartWeek = 15;
const championshipWeek = 17;

const playoffTeams = 7;


/* ================================
   GET CURRENT NFL WEEK FROM SLEEPER
================================ */

async function updateCurrentNFLState() {

    const response = await fetch(
        "https://api.sleeper.app/v1/state/nfl"
    );

    if (!response.ok) {
        throw new Error(
            "Could not get current NFL state from Sleeper."
        );
    }

    const state = await response.json();

    if (state.season) {
        currentSeason =
            Number(state.season);
    }

    if (state.week) {
        currentWeek =
            Number(state.week);
    }

    console.log(
        `Sleeper NFL State: ${currentSeason} Week ${currentWeek}`
    );
}


/* ================================
   LOAD ALL-TIME HISTORY
================================ */

async function loadHeadToHeadRecords() {

    headToHeadRecords = {};
    seasonHistory = {};

    for (const seasonData of leagueHistory) {

        try {

            const usersResponse = await fetch(
                `https://api.sleeper.app/v1/league/${seasonData.leagueId}/users`
            );

            const rostersResponse = await fetch(
                `https://api.sleeper.app/v1/league/${seasonData.leagueId}/rosters`
            );

            if (!usersResponse.ok || !rostersResponse.ok) {
                continue;
            }

            const seasonUsers =
                await usersResponse.json();

            const seasonRosters =
                await rostersResponse.json();


            /*
                Completed historical seasons get
                stored separately for the History page.
            */

            if (
                seasonData.season <
                currentSeason
            ) {

                seasonHistory[
                    seasonData.season
                ] = {

                    regularSeasonGames: [],

                    regularSeasonPoints: {},

                    playoffTeams: [],

                    playoffGames: []

                };

            }


            const maxWeek =
                seasonData.season === currentSeason
                    ? currentWeek
                    : championshipWeek;


            for (
                let week = 1;
                week <= maxWeek;
                week++
            ) {

                const response = await fetch(
                    `https://api.sleeper.app/v1/league/${seasonData.leagueId}/matchups/${week}`
                );

                if (!response.ok) {
                    continue;
                }

                const weekMatchups =
                    await response.json();

                const matchupGroups = {};


                weekMatchups.forEach(matchup => {

                    if (!matchup.matchup_id) {
                        return;
                    }

                    if (
                        !matchupGroups[
                            matchup.matchup_id
                        ]
                    ) {

                        matchupGroups[
                            matchup.matchup_id
                        ] = [];

                    }

                    matchupGroups[
                        matchup.matchup_id
                    ].push(matchup);

                });


                Object.values(
                    matchupGroups
                ).forEach(group => {

                    if (group.length !== 2) {
                        return;
                    }

                    const matchup1 = group[0];
                    const matchup2 = group[1];


                    if (
                        Number(matchup1.points || 0) === 0 &&
                        Number(matchup2.points || 0) === 0
                    ) {

                        return;

                    }


                    const roster1 =
                        seasonRosters.find(
                            roster =>
                                Number(
                                    roster.roster_id
                                ) ===
                                Number(
                                    matchup1.roster_id
                                )
                        );

                    const roster2 =
                        seasonRosters.find(
                            roster =>
                                Number(
                                    roster.roster_id
                                ) ===
                                Number(
                                    matchup2.roster_id
                                )
                        );


                    if (!roster1 || !roster2) {
                        return;
                    }


                    const user1 =
                        seasonUsers.find(
                            user =>
                                String(
                                    user.user_id
                                ) ===
                                String(
                                    roster1.owner_id
                                )
                        );

                    const user2 =
                        seasonUsers.find(
                            user =>
                                String(
                                    user.user_id
                                ) ===
                                String(
                                    roster2.owner_id
                                )
                        );


                    if (!user1 || !user2) {
                        return;
                    }


                    /*
                        IMPORTANT:

                        Use the canonical manager username
                        instead of the raw Sleeper display name.

                        This is what makes historical data
                        follow the correct manager.
                    */

                    const username1 =
                        getManagerUsername(
                            user1
                        );

                    const username2 =
                        getManagerUsername(
                            user2
                        );


                    const key = [
                        username1,
                        username2
                    ]
                        .sort()
                        .join("-");


                    if (!headToHeadRecords[key]) {

                        headToHeadRecords[key] = {
                            games: []
                        };

                    }


                    /*
                        Store the game using canonical
                        usernames from the beginning.
                    */

                    const game = {

                        season:
                            seasonData.season,

                        week,

                        username1,

                        username2,

                        score1:
                            Number(
                                matchup1.points || 0
                            ),

                        score2:
                            Number(
                                matchup2.points || 0
                            )

                    };


                    /*
                        Prevent the same historical game
                        from being accidentally added twice.
                    */

                    const duplicateGame =
                        headToHeadRecords[key]
                            .games
                            .some(existingGame =>
                                existingGame.season ===
                                    game.season &&
                                existingGame.week ===
                                    game.week &&
                                existingGame.username1 ===
                                    game.username1 &&
                                existingGame.username2 ===
                                    game.username2
                            );


                    if (!duplicateGame) {

                        headToHeadRecords[
                            key
                        ].games.push(
                            game
                        );

                    }


                    /*
                        Save completed-season games
                        for the History page.
                    */

                    if (
                        seasonData.season <
                        currentSeason
                    ) {

                        if (
                            week <=
                            regularSeasonEndWeek
                        ) {

                            seasonHistory[
                                seasonData.season
                            ]
                                .regularSeasonGames
                                .push(game);


                            const normalized1 =
                                normalizeManager(
                                    username1
                                );

                            const normalized2 =
                                normalizeManager(
                                    username2
                                );


                            seasonHistory[
                                seasonData.season
                            ]
                                .regularSeasonPoints[
                                    normalized1
                                ] =
                                (
                                    seasonHistory[
                                        seasonData.season
                                    ]
                                        .regularSeasonPoints[
                                            normalized1
                                        ] || 0
                                ) +
                                game.score1;


                            seasonHistory[
                                seasonData.season
                            ]
                                .regularSeasonPoints[
                                    normalized2
                                ] =
                                (
                                    seasonHistory[
                                        seasonData.season
                                    ]
                                        .regularSeasonPoints[
                                            normalized2
                                        ] || 0
                                ) +
                                game.score2;

                        }

                    }

                });

            }

        } catch (error) {

            console.error(
                `Error loading ${seasonData.season} history:`,
                error
            );

        }

    }

}


/* ================================
   GET ALL-TIME RECORD
================================ */

function getHeadToHeadRecord(
    username1,
    username2
) {

    /*
        Convert both managers to their
        permanent usernames first.
    */

    const manager1 =
        normalizeManager(
            username1
        );

    const manager2 =
        normalizeManager(
            username2
        );


    const key = [
        manager1,
        manager2
    ]
        .sort()
        .join("-");


    const record =
        headToHeadRecords[key];


    if (
        !record ||
        !record.games ||
        record.games.length === 0
    ) {

        return {
            wins1: 0,
            wins2: 0,
            games: 0
        };

    }


    let wins1 = 0;
    let wins2 = 0;


    record.games.forEach(game => {

        const gameUsername1 =
            normalizeManager(
                game.username1
            );

        const gameUsername2 =
            normalizeManager(
                game.username2
            );


        /*
            Determine which side of the
            historical matchup manager1 was on.
        */

        if (
            gameUsername1 ===
            manager1
        ) {

            if (
                game.score1 >
                game.score2
            ) {

                wins1++;

            } else if (
                game.score2 >
                game.score1
            ) {

                wins2++;

            }

        } else if (
            gameUsername2 ===
            manager1
        ) {

            if (
                game.score2 >
                game.score1
            ) {

                wins1++;

            } else if (
                game.score1 >
                game.score2
            ) {

                wins2++;

            }

        }

    });


    return {
        wins1,
        wins2,
        games: record.games.length
    };

}





    /*
        ====================================
        VERIFIED HISTORICAL PLAYOFF DATA
        ====================================

        These values are manually verified.

        They now use the same permanent
        usernames as the rest of the app.
    */

    const verifiedPlayoffStats = {

        zachridilla: {
            playoffPercentage: 75,
            playoffWins: 2,
            playoffLosses: 3
        },

        Spanky20025: {
            playoffPercentage: 100,
            playoffWins: 3,
            playoffLosses: 3
        },

        Aidan82: {
            playoffPercentage: 75,
            playoffWins: 7,
            playoffLosses: 2
        },

        Holtzy81: {
            playoffPercentage: 75,
            playoffWins: 0,
            playoffLosses: 3
        },

        jmanwos: {
            playoffPercentage: 75,
            playoffWins: 0,
            playoffLosses: 3
        },

        Zachmotil16: {
            playoffPercentage: 75,
            playoffWins: 7,
            playoffLosses: 1
        },

        Danny4200: {
            playoffPercentage: 75,
            playoffWins: 3,
            playoffLosses: 3
        },

        nickwast16: {
            playoffPercentage: 50,
            playoffWins: 2,
            playoffLosses: 2
        },

        grecko: {
            playoffPercentage: 66,
            playoffWins: 0,
            playoffLosses: 2
        },

        RowanAlexander: {
            playoffPercentage: 0,
            playoffWins: 0,
            playoffLosses: 0
        },

        tomsterdamonste: {
            playoffPercentage: 25,
            playoffWins: 0,
            playoffLosses: 1
        },

        ben: {
            playoffPercentage: 0,
            playoffWins: 0,
            playoffLosses: 0
        }

    };


    const verifiedChampionships = {

        Zachmotil16: 2,

        Spanky20025: 1,

        Aidan82: 1

    };


    const verifiedRunnerUps = {

        Danny4200: 1,

        nickwast16: 1,

        Aidan82: 2

    };


    /*
        ====================================
        CREATE MANAGER RECORDS
        ====================================
    */

    const managers = {};


    function createManager(name) {

        if (!name) {
            return;
        }


        const normalizedName =
            normalizeManager(
                name
            );


        if (!managers[normalizedName]) {

            managers[normalizedName] = {

                name:
                    normalizedName,

                wins: 0,

                losses: 0,

                ties: 0,

                playoffWins: 0,

                playoffLosses: 0,

                playoffMadePercentage: 0,

                championships: 0,

                runnerUps: 0,

                highPoints: 0

            };

        }

    }


    /*
        ====================================
        PROCESS REGULAR-SEASON HISTORY
        ====================================
    */

/* ================================
   DISPLAY HISTORY
================================ */

function displayHistory() {

    const container =
        document.getElementById(
            "history-table"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    /*
        ====================================
        VERIFIED HISTORICAL PLAYOFF DATA
        ====================================
    */

    const verifiedPlayoffStats = {

        zachridilla: {
            playoffPercentage: 75,
            playoffWins: 2,
            playoffLosses: 3
        },

        Spanky20025: {
            playoffPercentage: 100,
            playoffWins: 3,
            playoffLosses: 3
        },

        Aidan82: {
            playoffPercentage: 75,
            playoffWins: 7,
            playoffLosses: 2
        },

        Holtzy81: {
            playoffPercentage: 75,
            playoffWins: 0,
            playoffLosses: 3
        },

        jmanwos: {
            playoffPercentage: 75,
            playoffWins: 0,
            playoffLosses: 3
        },

        Zachmotil16: {
            playoffPercentage: 75,
            playoffWins: 7,
            playoffLosses: 1
        },

        Danny4200: {
            playoffPercentage: 75,
            playoffWins: 3,
            playoffLosses: 3
        },

        nickwast16: {
            playoffPercentage: 50,
            playoffWins: 2,
            playoffLosses: 2
        },

        grecko: {
            playoffPercentage: 66,
            playoffWins: 0,
            playoffLosses: 2
        },

        RowanAlexander: {
            playoffPercentage: 0,
            playoffWins: 0,
            playoffLosses: 0
        },

        tomsterdamonste: {
            playoffPercentage: 25,
            playoffWins: 0,
            playoffLosses: 1
        },

        ben: {
            playoffPercentage: 0,
            playoffWins: 0,
            playoffLosses: 0
        }

    };


    const verifiedChampionships = {

        Zachmotil16: 2,

        Spanky20025: 1,

        Aidan82: 1

    };


    const verifiedRunnerUps = {

        Danny4200: 1,

        nickwast16: 1,

        Aidan82: 2

    };


    /*
        ====================================
        CREATE MANAGER RECORDS
        ====================================
    */

    const managers = {};


    function createManager(name) {

        if (!name) {
            return;
        }


        const normalizedName =
            normalizeManager(
                name
            );


        if (!managers[normalizedName]) {

            managers[normalizedName] = {

                name:
                    normalizedName,

                wins: 0,

                losses: 0,

                ties: 0,

                playoffWins: 0,

                playoffLosses: 0,

                playoffMadePercentage: 0,

                championships: 0,

                runnerUps: 0,

                highPoints: 0

            };

        }

    }


    /*
        ====================================
        PROCESS REGULAR-SEASON HISTORY
        ====================================
    */

    Object.values(
        seasonHistory
    ).forEach(history => {

        history.regularSeasonGames
            .forEach(game => {

                const manager1 =
                    normalizeManager(
                        game.username1
                    );


                const manager2 =
                    normalizeManager(
                        game.username2
                    );


                createManager(
                    manager1
                );

                createManager(
                    manager2
                );


                if (
                    game.score1 >
                    game.score2
                ) {

                    managers[
                        manager1
                    ].wins++;

                    managers[
                        manager2
                    ].losses++;

                } else if (
                    game.score2 >
                    game.score1
                ) {

                    managers[
                        manager2
                    ].wins++;

                    managers[
                        manager1
                    ].losses++;

                } else {

                    managers[
                        manager1
                    ].ties++;

                    managers[
                        manager2
                    ].ties++;

                }

            });


        /*
            Find the manager(s) who finished
            first in total regular-season points.
        */

        const pointEntries =
            Object.entries(
                history.regularSeasonPoints
            );


        if (
            pointEntries.length > 0
        ) {

            const highestPoints =
                Math.max(
                    ...pointEntries.map(
                        ([, points]) =>
                            Number(points)
                    )
                );


            pointEntries.forEach(
                ([manager, points]) => {

                    if (
                        Number(points) ===
                        highestPoints
                    ) {

                        createManager(
                            manager
                        );

                        managers[
                            normalizeManager(
                                manager
                            )
                        ].highPoints++;

                    }

                }
            );

        }

    });


    /*
        ====================================
        APPLY VERIFIED PLAYOFF DATA
        ====================================
    */

    Object.entries(
        verifiedPlayoffStats
    ).forEach(
        ([managerName, stats]) => {

            createManager(
                managerName
            );


            const manager =
                managers[
                    normalizeManager(
                        managerName
                    )
                ];


            manager.playoffWins =
                stats.playoffWins;

            manager.playoffLosses =
                stats.playoffLosses;

            manager.playoffMadePercentage =
                stats.playoffPercentage;

        }
    );


    Object.entries(
        verifiedChampionships
    ).forEach(
        ([managerName, championships]) => {

            createManager(
                managerName
            );


            managers[
                normalizeManager(
                    managerName
                )
            ].championships =
                championships;

        }
    );


    Object.entries(
        verifiedRunnerUps
    ).forEach(
        ([managerName, runnerUps]) => {

            createManager(
                managerName
            );


            managers[
                normalizeManager(
                    managerName
                )
            ].runnerUps =
                runnerUps;

        }
    );


    /*
        ====================================
        ADD CURRENT-SEASON MANAGERS
        ====================================
    */

    users.forEach(user => {

        createManager(
            getManagerUsername(
                user
            )
        );

    });


    /*
        ====================================
        SORT MANAGERS
        ====================================
    */

    const managerArray =
        Object.values(
            managers
        );


    managerArray.sort(
        (a, b) => {

            const totalGamesA =
                a.wins +
                a.losses +
                a.ties;


            const totalGamesB =
                b.wins +
                b.losses +
                b.ties;


            const winPercentageA =
                totalGamesA > 0
                    ? a.wins /
                        totalGamesA
                    : 0;


            const winPercentageB =
                totalGamesB > 0
                    ? b.wins /
                        totalGamesB
                    : 0;


            return (
                winPercentageB -
                winPercentageA
            );

        }
    );


    /*
        ====================================
        HISTORY HEADER
        ====================================
    */

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "history-header";


    header.style.display =
        "grid";

    header.style.gridTemplateColumns =
        "2fr 1.2fr 1fr 1.2fr 1.2fr 1fr 1fr 1.4fr";

    header.style.gap =
        "12px";

    header.style.alignItems =
        "center";

    header.style.padding =
        "16px 14px";

    header.style.fontWeight =
        "700";

    header.style.fontSize =
        "13px";

    header.style.textTransform =
        "uppercase";

    header.style.letterSpacing =
        "0.5px";

    header.style.borderBottom =
        "2px solid #d4af37";


    const headerNames = [

        "Manager",

        "All-Time Record",

        "Win %",

        "Playoff Made %",

        "Playoff W-L",

        "Championships",

        "Runner-Up",

        "Highest Points"

    ];


    headerNames.forEach(
        name => {

            const cell =
                document.createElement(
                    "div"
                );


            cell.textContent =
                name;


            header.appendChild(
                cell
            );

        }
    );


    container.appendChild(
        header
    );


    /*
        ====================================
        HISTORY ROWS
        ====================================
    */

    managerArray.forEach(
        manager => {

            const totalGames =
                manager.wins +
                manager.losses +
                manager.ties;


            const winPercentage =
                totalGames > 0
                    ? (
                        manager.wins /
                        totalGames
                    ) * 100
                    : 0;


            const playoffGames =
                manager.playoffWins +
                manager.playoffLosses;


            const playoffRecord =
                playoffGames > 0
                    ? `${manager.playoffWins}-${manager.playoffLosses}`
                    : "0-0";


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "history-row";


            row.style.display =
                "grid";

            row.style.gridTemplateColumns =
                "2fr 1.2fr 1fr 1.2fr 1.2fr 1fr 1fr 1.4fr";

            row.style.gap =
                "12px";

            row.style.alignItems =
                "center";

            row.style.padding =
                "16px 14px";

            row.style.borderBottom =
                "1px solid rgba(255,255,255,0.08)";

            row.style.minHeight =
                "52px";


            const values = [

                manager.name,

                `${manager.wins}-${manager.losses}${manager.ties > 0 ? `-${manager.ties}` : ""}`,

                `${winPercentage.toFixed(1)}%`,

                `${manager.playoffMadePercentage}%`,

                playoffRecord,

                manager.championships,

                manager.runnerUps,

                manager.highPoints

            ];


            values.forEach(
                (value, index) => {

                    const cell =
                        document.createElement(
                            "div"
                        );


                    cell.textContent =
                        value;


                    cell.style.minWidth =
                        "0";

                    cell.style.overflow =
                        "hidden";

                    cell.style.textOverflow =
                        "ellipsis";

                    cell.style.whiteSpace =
                        "nowrap";


                    if (index === 0) {

                        cell.style.fontWeight =
                            "700";

                    }


                    row.appendChild(
                        cell
                    );

                }
            );


            container.appendChild(
                row
            );

        }
    );

}    

/* ================================
   GET USER
================================ */

function getUser(rosterId) {

    const roster =
        rosters.find(
            roster =>
                Number(
                    roster.roster_id
                ) ===
                Number(
                    rosterId
                )
        );


    if (!roster) {
        return null;
    }


    return users.find(
        user =>
            String(
                user.user_id
            ) ===
            String(
                roster.owner_id
            )
    );

}


/* ================================
   GET TEAM NAME
================================ */

function getTeamName(
    rosterId
) {

    const roster =
        rosters.find(
            roster =>
                Number(
                    roster.roster_id
                ) ===
                Number(
                    rosterId
                )
        );


    if (!roster) {
        return "Unknown Team";
    }


    const user =
        getUser(
            rosterId
        );


    if (!user) {
        return "Unknown Team";
    }


    return (
        user.metadata?.team_name ||
        user.display_name ||
        user.username ||
        "Unknown Team"
    );

}


/* ================================
   GET PLAYER PROJECTION
================================ */
function getPlayerProjection(
    playerId
) {

    if (
        !projections ||
        !playerId
    ) {
        return 0;
    }


    const id =
        String(
            playerId
        );


    let playerProjection =
        null;


    /*
        Sleeper normally returns
        an array of projection rows.
    */

    if (
        Array.isArray(
            projections
        )
    ) {

        playerProjection =
            projections.find(
                projection => {

                    return (
                        String(
                            projection.player_id
                        ) ===
                        id
                    );

                }
            );

    }


    /*
        Some Sleeper responses
        are keyed by player ID.
    */

    else if (
        typeof projections ===
        "object"
    ) {

        playerProjection =
            projections[id];

    }


    if (
        !playerProjection
    ) {
        return 0;
    }


    /*
        Try every common location
        for the PPR projection.
    */

    const possibleValues = [

        playerProjection
            .stats
            ?.pts_ppr,

        playerProjection
            .pts_ppr,

        playerProjection
            .projection
            ?.pts_ppr,

        playerProjection
            .stats
            ?.pts_half_ppr,

        playerProjection
            .stats
            ?.pts_std,

        playerProjection
            .projection
            ?.pts_half_ppr,

        playerProjection
            .projection
            ?.pts_std

    ];


    for (
        const value
        of possibleValues
    ) {

        if (
            value !==
            undefined &&
            value !==
            null &&
            value !==
            ""
        ) {

            const number =
                Number(
                    value
                );


            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;

            }

        }

    }


    return 0;

}
/* ================================
   GET ROSTER PROJECTION
================================ */
function getRosterProjection(
    roster
) {

    if (
        !roster
    ) {
        return 0;
    }


    const starters =
        Array.isArray(
            roster.starters
        )
            ? roster.starters
            : [];


    let total = 0;


    starters.forEach(
        playerId => {

            if (
                !playerId ||
                playerId ===
                "0"
            ) {
                return;
            }


            total +=
                getPlayerProjection(
                    playerId
                );

        }
    );


    return total;

}
/* ================================
   GET SEASON MATCHUP NUMBER
================================ */

function getSeasonMatchupNumber(
    rosterId,
    opponentRosterId,
    week
) {

    const matchup =
        matchups.find(
            matchup =>
                Number(
                    matchup.roster_id
                ) ===
                Number(
                    rosterId
                ) &&
                Number(
                    matchup.week
                ) ===
                Number(
                    week
                )
        );


    if (
        matchup &&
        matchup.matchup_id !==
        null &&
        matchup.matchup_id !==
        undefined
    ) {

        return matchup.matchup_id;

    }


    return null;

}
/* ================================
   DISPLAY MATCHUPS
================================ */

async function displayMatchups() {

    const container =
        document.getElementById("matchups") ||
        document.getElementById("matchups-container");

    if (!container) {
        console.error("MATCHUPS CONTAINER NOT FOUND");
        return;
    }

    container.innerHTML = "";

    if (!Array.isArray(matchups) || matchups.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No matchup data available.
            </div>
        `;

        return;
    }

    const matchupGroups = {};

    matchups.forEach(matchup => {

        if (
            matchup.matchup_id === null ||
            matchup.matchup_id === undefined
        ) {
            return;
        }

        const matchupId =
            String(matchup.matchup_id);

        if (!matchupGroups[matchupId]) {
            matchupGroups[matchupId] = [];
        }

        matchupGroups[matchupId].push(matchup);

    });

    const groups =
        Object.values(matchupGroups);

    let matchupNumber = 0;

    for (const group of groups) {

        if (group.length !== 2) {
            continue;
        }

        matchupNumber++;

        const matchup1 = group[0];
        const matchup2 = group[1];

        const roster1 =
            rosters.find(
                roster =>
                    Number(roster.roster_id) ===
                    Number(matchup1.roster_id)
            );

        const roster2 =
            rosters.find(
                roster =>
                    Number(roster.roster_id) ===
                    Number(matchup2.roster_id)
            );

        if (!roster1 || !roster2) {
            continue;
        }

        const user1 =
            users.find(
                user =>
                    String(user.user_id) ===
                    String(roster1.owner_id)
            );

        const user2 =
            users.find(
                user =>
                    String(user.user_id) ===
                    String(roster2.owner_id)
            );

        if (!user1 || !user2) {
            continue;
        }

        const teamName1 =
            user1.metadata?.team_name ||
            user1.display_name ||
            "Unknown Team";

        const teamName2 =
            user2.metadata?.team_name ||
            user2.display_name ||
            "Unknown Team";

        const username1 =
            getManagerUsername(user1);

        const username2 =
            getManagerUsername(user2);

        const actualScore1 =
            Number(matchup1.points || 0);

        const actualScore2 =
            Number(matchup2.points || 0);

        const projection1 =
            Number(
                getRosterProjection(roster1) || 0
            );

        const projection2 =
            Number(
                getRosterProjection(roster2) || 0
            );

        const totalProjection =
            projection1 + projection2;

        const percent1 =
            totalProjection > 0
                ? (projection1 / totalProjection) * 100
                : 50;

        const percent2 =
            100 - percent1;

        const h2h =
            getHeadToHeadRecord(
                username1,
                username2
            );

        let seriesText;

        if (h2h.games === 0) {

            seriesText =
                "FIRST MEETING";

        } else {

            seriesText =
                `${username1} ${h2h.wins1}-${h2h.wins2} ${username2}`;

        }

        const matchupCard =
            document.createElement("div");

        matchupCard.className =
            "matchup-card";

        matchupCard.innerHTML = `

            <div class="matchup-card-header">

                <div>
                    <span class="matchup-label">
                        WEEK ${currentWeek}
                    </span>

                    <h3>
                        MATCHUP ${matchupNumber}
                    </h3>
                </div>

                <div class="matchup-series">
                    ALL-TIME SERIES
                    <strong>
                        ${seriesText}
                    </strong>
                </div>

            </div>

            <div class="matchup-teams">

                <div class="matchup-team matchup-team-left">

                    <strong>
                        ${teamName1}
                    </strong>

                    <small>
                        ${username1}
                    </small>

                    <div class="actual-score">
                        ${actualScore1.toFixed(2)}
                    </div>

                    <div class="projected-score">
                        ${projection1.toFixed(2)} projected
                    </div>

                </div>

                <div class="matchup-vs">
                    VS
                </div>

                <div class="matchup-team matchup-team-right">

                    <strong>
                        ${teamName2}
                    </strong>

                    <small>
                        ${username2}
                    </small>

                    <div class="actual-score">
                        ${actualScore2.toFixed(2)}
                    </div>

                    <div class="projected-score">
                        ${projection2.toFixed(2)} projected
                    </div>

                </div>

            </div>

            <div class="projection-bar">

                <div
                    class="projection-fill-one"
                    style="width:${percent1}%"
                ></div>

                <div
                    class="projection-fill-two"
                    style="width:${percent2}%"
                ></div>

            </div>

        `;

        container.appendChild(
            matchupCard
        );

    }

    if (container.children.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No matchups could be displayed.
            </div>
        `;

    }

}
/* ================================
   STANDINGS
================================ */
async function displayStandings() {

    const container =
        document.getElementById(
            "standings"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";


    /*
        =========================================
        CALCULATE CURRENT WIN/LOSS STREAKS
        =========================================

        We store the result for EACH specific week.

        Example:

        Week 1 = L
        Week 2 = W
        Week 3 = W
        Week 4 = W

        Current streak = W3

        This prevents missing/incomplete weeks
        from being accidentally counted.
    */

    const weeklyResults = {};


    rosters.forEach(
        roster => {

            weeklyResults[
                roster.roster_id
            ] = {};

        }
    );


    /*
        Find the most recent FULLY completed week.
    */

    let latestCompletedWeek = 0;


    for (
        let week = 1;
        week <= currentWeek;
        week++
    ) {

        try {

            const response =
                await fetch(
                    `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`
                );


            if (
                !response.ok
            ) {
                continue;
            }


            const weekMatchups =
                await response.json();


            if (
                !Array.isArray(
                    weekMatchups
                )
            ) {
                continue;
            }


            const matchupGroups = {};


            weekMatchups.forEach(
                matchup => {

                    if (
                        matchup.matchup_id ===
                        null ||
                        matchup.matchup_id ===
                        undefined
                    ) {
                        return;
                    }


                    if (
                        !matchupGroups[
                            matchup.matchup_id
                        ]
                    ) {

                        matchupGroups[
                            matchup.matchup_id
                        ] = [];

                    }


                    matchupGroups[
                        matchup.matchup_id
                    ].push(
                        matchup
                    );

                }
            );


            const games =
                Object.values(
                    matchupGroups
                ).filter(
                    game =>
                        game.length === 2
                );


            /*
                A 12-team league has 6 games.

                Require all 6 games to have
                actual scores before considering
                the week complete.
            */

            if (
                games.length !== 6
            ) {
                continue;
            }


            let weekIsComplete =
                true;


            games.forEach(
                game => {

                    const score1 =
                        Number(
                            game[0].points ||
                            0
                        );

                    const score2 =
                        Number(
                            game[1].points ||
                            0
                        );


                    if (
                        score1 <= 0 ||
                        score2 <= 0
                    ) {

                        weekIsComplete =
                            false;

                    }

                }
            );


            if (
                !weekIsComplete
            ) {
                continue;
            }


            /*
                This week is fully complete.
            */

            latestCompletedWeek =
                week;


            /*
                Save the result under the
                ACTUAL WEEK NUMBER.
            */

            games.forEach(
                game => {

                    const roster1 =
                        Number(
                            game[0].roster_id
                        );

                    const roster2 =
                        Number(
                            game[1].roster_id
                        );


                    const score1 =
                        Number(
                            game[0].points ||
                            0
                        );

                    const score2 =
                        Number(
                            game[1].points ||
                            0
                        );


                    if (
                        score1 >
                        score2
                    ) {

                        if (
                            weeklyResults[
                                roster1
                            ]
                        ) {

                            weeklyResults[
                                roster1
                            ][week] =
                                "W";

                        }

                        if (
                            weeklyResults[
                                roster2
                            ]
                        ) {

                            weeklyResults[
                                roster2
                            ][week] =
                                "L";

                        }

                    } else if (
                        score2 >
                        score1
                    ) {

                        if (
                            weeklyResults[
                                roster2
                            ]
                        ) {

                            weeklyResults[
                                roster2
                            ][week] =
                                "W";

                        }

                        if (
                            weeklyResults[
                                roster1
                            ]
                        ) {

                            weeklyResults[
                                roster1
                            ][week] =
                                "L";

                        }

                    } else {

                        if (
                            weeklyResults[
                                roster1
                            ]
                        ) {

                            weeklyResults[
                                roster1
                            ][week] =
                                "T";

                        }

                        if (
                            weeklyResults[
                                roster2
                            ]
                        ) {

                            weeklyResults[
                                roster2
                            ][week] =
                                "T";

                        }

                    }

                }
            );

        } catch (
            error
        ) {

            console.error(
                `Error loading Week ${week} streak data:`,
                error
            );

        }

    }


    /*
        =========================================
        GET CURRENT STREAK FOR EVERY TEAM
        =========================================
    */

    const currentStreaks = {};


    rosters.forEach(
        roster => {

            const results =
                weeklyResults[
                    roster.roster_id
                ] || {};


            /*
                No completed weeks.
            */

            if (
                latestCompletedWeek === 0
            ) {

                currentStreaks[
                    roster.roster_id
                ] = "0";

                return;

            }


            const latestResult =
                results[
                    latestCompletedWeek
                ];


            /*
                If a team somehow has no result
                for the latest completed week,
                show 0 rather than making up
                a streak.
            */

            if (
                !latestResult ||
                latestResult === "T"
            ) {

                currentStreaks[
                    roster.roster_id
                ] = "0";

                return;

            }


            let streakCount = 0;


            /*
                Work backward through the
                ACTUAL WEEK NUMBERS.

                This is the important part.
            */

            for (
                let week =
                    latestCompletedWeek;

                week >= 1;

                week--
            ) {

                const result =
                    results[week];


                /*
                    Stop immediately if there
                    is no result for that week.
                */

                if (
                    !result
                ) {

                    break;

                }


                /*
                    Stop when the result changes.
                */

                if (
                    result !==
                    latestResult
                ) {

                    break;

                }


                streakCount++;

            }


            currentStreaks[
                roster.roster_id
            ] =
                `${latestResult}${streakCount}`;

        }
    );


    /*
        =========================================
        SORT STANDINGS
        =========================================
    */

    const sortedRosters =
        [...rosters].sort(
            (a, b) => {

                const winsA =
                    Number(
                        a.settings?.wins ||
                        0
                    );

                const winsB =
                    Number(
                        b.settings?.wins ||
                        0
                    );


                if (
                    winsB !==
                    winsA
                ) {

                    return (
                        winsB -
                        winsA
                    );

                }


                const pointsA =
                    Number(
                        a.settings?.fpts ||
                        0
                    );

                const pointsB =
                    Number(
                        b.settings?.fpts ||
                        0
                    );


                return (
                    pointsB -
                    pointsA
                );

            }
        );


    /*
        =========================================
        HEADER
        =========================================
    */

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "standings-header";


    header.innerHTML = `

        <div>RK</div>

        <div>TEAM NAME</div>

        <div>OWNER</div>

        <div>RECORD</div>

        <div>WIN STREAK</div>

        <div>PF</div>

        <div>PA</div>

    `;


    container.appendChild(
        header
    );


    /*
        =========================================
        TEAM ROWS
        =========================================
    */

    sortedRosters.forEach(
        (roster, index) => {

            const teamName =
                getTeamName(
                    roster.roster_id
                );


            const user =
                users.find(
                    user =>
                        String(
                            user.user_id
                        ) ===
                        String(
                            roster.owner_id
                        )
                );


            const manager =
                user?.display_name ||
                "";


            const wins =
                Number(
                    roster.settings?.wins ||
                    0
                );


            const losses =
                Number(
                    roster.settings?.losses ||
                    0
                );


            const pointsFor =
                Number(
                    roster.settings?.fpts ||
                    0
                );


            const pointsAgainst =
                Number(
                    roster.settings?.fpts_against ||
                    0
                );


            const streak =
                currentStreaks[
                    roster.roster_id
                ] || "0";


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "standings-row";


            row.innerHTML = `

                <div class="standings-rank">
                    ${index + 1}
                </div>

                <div class="standings-team">
                    ${teamName}
                </div>

                <div class="standings-manager">
                    ${manager}
                </div>

                <div class="standings-record">
                    ${wins}-${losses}
                </div>

                <div class="standings-streak">
                    ${streak}
                </div>

                <div class="standings-points">
                    ${pointsFor.toFixed(2)}
                </div>

                <div class="standings-points-against">
                    ${pointsAgainst.toFixed(2)}
                </div>

            `;


            container.appendChild(
                row
            );

        }
    );

}
/* ================================
   PLAYOFF TEAM STRENGTH
================================ */

function calculateTeamStrength(
    roster
) {

    const points =
        Number(
            roster.settings?.fpts ||
            0
        );

    const wins =
        Number(
            roster.settings?.wins ||
            0
        );

    const losses =
        Number(
            roster.settings?.losses ||
            0
        );

    const pointsAgainst =
        Number(
            roster.settings?.fpts_against ||
            0
        );

    const gamesPlayed =
        wins +
        losses;

    if (
        gamesPlayed === 0
    ) {

        return 100;

    }


    /*
        We only have a small sample
        early in the season.

        The more games that have been
        played, the more we trust the
        team's actual performance.

        After only 3 games, we heavily
        regress toward the league average.
    */

    const leagueTeams =
        rosters.filter(
            otherRoster => {

                const otherWins =
                    Number(
                        otherRoster.settings?.wins ||
                        0
                    );

                const otherLosses =
                    Number(
                        otherRoster.settings?.losses ||
                        0
                    );

                return (
                    otherWins +
                    otherLosses
                ) > 0;

            }
        );


    const leagueAveragePPG =
        leagueTeams.reduce(
            (
                total,
                otherRoster
            ) => {

                const otherWins =
                    Number(
                        otherRoster.settings?.wins ||
                        0
                    );

                const otherLosses =
                    Number(
                        otherRoster.settings?.losses ||
                        0
                    );

                const otherGames =
                    otherWins +
                    otherLosses;

                const otherPoints =
                    Number(
                        otherRoster.settings?.fpts ||
                        0
                    );

                return (
                    total +
                    (
                        otherPoints /
                        otherGames
                    )
                );

            },
            0
        ) /
        Math.max(
            leagueTeams.length,
            1
        );


    const pointsPerGame =
        points /
        gamesPlayed;


    const winPercentage =
        wins /
        gamesPlayed;


    const pointsAgainstPerGame =
        pointsAgainst /
        gamesPlayed;


    /*
        Regression toward the league average.

        Three games = only 30% trust
        in the team's current scoring.

        This prevents a hot start from
        becoming an enormous strength gap.
    */

    const sampleWeight =
        Math.min(
            gamesPlayed / 10,
            0.70
        );


    const adjustedPPG =
        (
            pointsPerGame *
            sampleWeight
        ) +
        (
            leagueAveragePPG *
            (1 - sampleWeight)
        );


    const scoringStrength =
        adjustedPPG;


    /*
        Record matters, but less than
        actual scoring performance.
    */

    const recordStrength =
        (
            winPercentage *
            100
        );


    /*
        Points allowed gives us another
        measure of team quality without
        allowing one hot offense to
        completely dominate the model.
    */

    const pointsAgainstStrength =
        Math.max(
            50,
            100 -
            (
                pointsAgainstPerGame -
                leagueAveragePPG
            )
        );


    let baseStrength =
    (
        scoringStrength *
        0.65
    ) +
    (
        recordStrength *
        0.10
    ) +
    (
        pointsAgainstStrength *
        0.25
    );


    /*
        Strength of schedule.

        We look at the actual opponents
        this team has left on its schedule.
    */

    let opponentStrengthTotal =
        0;

    let opponentCount =
        0;


    for (
        let week =
            currentWeek + 1;

        week <=
            regularSeasonEndWeek;

        week++
    ) {

        const weekMatchups =
            remainingMatchups[
                week
            ] || [];


        const teamMatchups =
            weekMatchups.filter(
                matchup =>
                    Number(
                        matchup.roster_id
                    ) ===
                    Number(
                        roster.roster_id
                    )
            );


        teamMatchups.forEach(
            matchup => {

                if (
                    matchup.matchup_id ===
                    null ||
                    matchup.matchup_id ===
                    undefined
                ) {
                    return;
                }


                const opponent =
                    weekMatchups.find(
                        otherMatchup =>
                            Number(
                                otherMatchup.matchup_id
                            ) ===
                            Number(
                                matchup.matchup_id
                            ) &&
                            Number(
                                otherMatchup.roster_id
                            ) !==
                            Number(
                                roster.roster_id
                            )
                    );


                if (!opponent) {
                    return;
                }


                const opponentRoster =
                    rosters.find(
                        otherRoster =>
                            Number(
                                otherRoster.roster_id
                            ) ===
                            Number(
                                opponent.roster_id
                            )
                    );


                if (!opponentRoster) {
                    return;
                }


                const opponentWins =
                    Number(
                        opponentRoster.settings?.wins ||
                        0
                    );


                const opponentLosses =
                    Number(
                        opponentRoster.settings?.losses ||
                        0
                    );


                const opponentGames =
                    opponentWins +
                    opponentLosses;


                if (
                    opponentGames ===
                    0
                ) {
                    return;
                }


                const opponentPoints =
                    Number(
                        opponentRoster.settings?.fpts ||
                        0
                    );


                const opponentPPG =
                    opponentPoints /
                    opponentGames;


                opponentStrengthTotal +=
                    opponentPPG;

                opponentCount++;

            }
        );

    }


    if (
        opponentCount >
        0
    ) {

        const averageOpponentStrength =
            opponentStrengthTotal /
            opponentCount;


        const sosDifference =
            averageOpponentStrength -
            leagueAveragePPG;


        /*
            Keep SOS relatively small.

            A difficult schedule should matter,
            but it should not completely
            override the team's own performance.
        */

        const sosAdjustment =
            sosDifference *
            0.15;


        baseStrength +=
            sosAdjustment;

    }


    /*
        Regress the final strength toward
        the league average one more time.

        This keeps Week 3 projections
        from becoming overly confident.
    */

    const finalStrength =
        (
            baseStrength *
            0.75
        ) +
        (
            leagueAveragePPG *
            0.25
        );


    return Math.max(
        finalStrength,
        1
    );

}

/* ================================
   WIN PROBABILITY
================================ */

function getWinProbability(
    teamA,
    teamB
) {

    const strengthDifference =
        teamA.strength -
        teamB.strength;


    /*
        Convert strength difference
        into a realistic weekly
        win probability.

        A larger denominator makes
        the model less confident,
        which is important this early
        in the season.
    */

    let probability =
        1 /
        (
            1 +
            Math.exp(
                -strengthDifference /
                35
            )
        );


    /*
        No team should be treated as
        essentially unbeatable or
        impossible to beat.
    */

    probability =
        Math.max(
            0.15,
            Math.min(
                0.85,
                probability
            )
        );


    return probability;

}


/* ================================
   SIMULATE ONE GAME
================================ */

function simulateGame(
    teamA,
    teamB
) {

    const modelProbability =
        getWinProbability(
            teamA,
            teamB
        );


    /*
        We do not want the model to assume
        that today's team strength will remain
        perfectly accurate for the rest of
        the season.

        Pull the probability toward 50/50
        to account for injuries, lineup changes,
        variance, bad weeks and unexpected results.
    */

    const futureUncertainty =
        0.25;


    const probabilityA =
        (
            modelProbability *
            (1 - futureUncertainty)
        ) +
        (
            0.50 *
            futureUncertainty
        );


    /*
        Generate the actual simulated scores.

        The larger random range creates realistic
        week-to-week volatility.
    */

    const baseScoreA =
        teamA.strength +
        (
            Math.random() *
            80
        ) -
        40;


    const baseScoreB =
        teamB.strength +
        (
            Math.random() *
            80
        ) -
        40;


    let winner;


    /*
        Use BOTH the model probability and the
        simulated score.

        Most of the time the stronger team will
        still win, but a bad score can create
        an upset.
    */

    const scoreDifference =
        baseScoreA -
        baseScoreB;


    const scoreAdjustment =
        Math.max(
            -0.15,
            Math.min(
                0.15,
                scoreDifference / 200
            )
        );


    const finalProbabilityA =
        Math.max(
            0.20,
            Math.min(
                0.80,
                probabilityA +
                scoreAdjustment
            )
        );


    if (
        Math.random() <
        finalProbabilityA
    ) {

        winner = teamA;

    } else {

        winner = teamB;

    }


    const loser =
        winner === teamA
            ? teamB
            : teamA;


    winner.wins++;

    loser.losses++;


    const finalScoreA =
        Math.max(
            50,
            baseScoreA
        );


    const finalScoreB =
        Math.max(
            50,
            baseScoreB
        );


    teamA.points +=
        finalScoreA;


    teamB.points +=
        finalScoreB;


    return {

        winner,

        loser,

        scoreA:
            finalScoreA,

        scoreB:
            finalScoreB

    };

}

/* ================================
   CHECK CLINCHED PLAYOFF SPOT
================================ */

function hasClinchedPlayoffSpot(
    roster
) {

    const wins =
        Number(
            roster.settings?.wins ||
            0
        );

    const losses =
        Number(
            roster.settings?.losses ||
            0
        );


    const gamesRemaining =
        Math.max(
            0,
            regularSeasonEndWeek -
            currentWeek
        );


    const possibleWins =
        wins +
        gamesRemaining;


    if (
        wins >=
        playoffTeams
    ) {

        return true;

    }


    return false;

}


/* ================================
   SIMULATE PLAYOFFS
================================ */

function simulatePlayoffs() {

    const playoffCounts = {};

    const championshipCounts = {};


    rosters.forEach(
        roster => {

            playoffCounts[
                roster.roster_id
            ] = 0;


            championshipCounts[
                roster.roster_id
            ] = 0;

        }
    );


    const teams =
        rosters.map(
            roster => {

                const wins =
                    Number(
                        roster.settings?.wins ||
                        0
                    );


                const losses =
                    Number(
                        roster.settings?.losses ||
                        0
                    );


                const points =
                    Number(
                        roster.settings?.fpts ||
                        0
                    );


                return {

                    rosterId:
                        roster.roster_id,

                    wins,

                    losses,

                    points,

                    strength:
                        calculateTeamStrength(
                            roster
                        )

                };

            }
        );


    for (
        let simulation = 0;

        simulation <
        simulations;

        simulation++
    ) {

    const simulatedTeams =
    teams.map(
        team => {

            /*
                Every simulated season gets
                a different level of uncertainty.

                This represents things we cannot
                know after only three weeks:

                injuries,
                lineup changes,
                regression,
                breakout players,
                bad stretches,
                good stretches,
                etc.
            */

        const seasonVariance =
    (
        Math.random() *
        70
    ) -
    35;    


            return {

                rosterId:
                    team.rosterId,

                wins:
                    team.wins,

                losses:
                    team.losses,

                points:
                    team.points,

                strength:
                    team.strength +
                    seasonVariance

            };

        }
    );    


        /*
            REGULAR SEASON
            WEEKS 5-14
        */

        for (
            let week =
                currentWeek + 1;

            week <=
            regularSeasonEndWeek;

            week++
        ) {

            const weekMatchups =
                remainingMatchups[
                    week
                ] ||
                [];


            const matchupGroups = {};


            weekMatchups.forEach(
                matchup => {

                    if (
                        matchup.matchup_id ===
                        null ||
                        matchup.matchup_id ===
                        undefined
                    ) {

                        return;

                    }


                    if (
                        !matchupGroups[
                            matchup.matchup_id
                        ]
                    ) {

                        matchupGroups[
                            matchup.matchup_id
                        ] = [];

                    }


                    matchupGroups[
                        matchup.matchup_id
                    ].push(
                        matchup
                    );

                }
            );


            Object.values(
                matchupGroups
            ).forEach(
                game => {

                    if (
                        game.length !==
                        2
                    ) {

                        return;

                    }


                    const teamA =
                        simulatedTeams.find(
                            team =>
                                Number(
                                    team.rosterId
                                ) ===
                                Number(
                                    game[0]
                                        .roster_id
                                )
                        );


                    const teamB =
                        simulatedTeams.find(
                            team =>
                                Number(
                                    team.rosterId
                                ) ===
                                Number(
                                    game[1]
                                        .roster_id
                                )
                        );


                    if (
                        !teamA ||
                        !teamB
                    ) {

                        return;

                    }


                    simulateGame(
                        teamA,
                        teamB
                    );

                }
            );

        }


        /*
            FINAL REGULAR-SEASON
            STANDINGS
        */

        simulatedTeams.sort(
            (a, b) => {

                if (
                    b.wins !==
                    a.wins
                ) {

                    return (
                        b.wins -
                        a.wins
                    );

                }


                return (
                    b.points -
                    a.points
                );

            }
        );


        /*
            TOP SEVEN MAKE PLAYOFFS
        */

        const playoffRosters =
            simulatedTeams.slice(
                0,
                playoffTeams
            );


        playoffRosters.forEach(
            team => {

                playoffCounts[
                    team.rosterId
                ]++;

            }
        );


        if (
            playoffRosters.length <
            playoffTeams
        ) {

            continue;

        }


        const seed1 =
            playoffRosters[0];

        const seed2 =
            playoffRosters[1];

        const seed3 =
            playoffRosters[2];

        const seed4 =
            playoffRosters[3];

        const seed5 =
            playoffRosters[4];

        const seed6 =
            playoffRosters[5];

        const seed7 =
            playoffRosters[6];


        /*
            WEEK 15
            ROUND 1
        */

        const game1 =
            simulateGame(
                {
                    ...seed2,
                    wins: 0,
                    losses: 0,
                    points: 0
                },
                {
                    ...seed7,
                    wins: 0,
                    losses: 0,
                    points: 0
                }
            );


        const game2 =
            simulateGame(
                {
                    ...seed3,
                    wins: 0,
                    losses: 0,
                    points: 0
                },
                {
                    ...seed6,
                    wins: 0,
                    losses: 0,
                    points: 0
                }
            );


        const game3 =
            simulateGame(
                {
                    ...seed4,
                    wins: 0,
                    losses: 0,
                    points: 0
                },
                {
                    ...seed5,
                    wins: 0,
                    losses: 0,
                    points: 0
                }
            );


        /*
            WEEK 16
            SEMIFINALS
        */

        const round1Winners = [

            {
                team:
                    game1.winner,

                seed:
                    2
            },

            {
                team:
                    game2.winner,

                seed:
                    3
            },

            {
                team:
                    game3.winner,

                seed:
                    4
            }

        ];


        round1Winners.sort(
            (a, b) =>
                a.seed -
                b.seed
        );


        const lowestRemaining =
            round1Winners[
                round1Winners.length - 1
            ];


        const otherWinners =
            round1Winners.slice(
                0,
                round1Winners.length - 1
            );


        const semifinal1 =
            simulateGame(
                {
                    ...seed1,
                    wins: 0,
                    losses: 0,
                    points: 0
                },
                {
                    ...lowestRemaining.team,
                    wins: 0,
                    losses: 0,
                    points: 0
                }
            );


        const semifinal2 =
            simulateGame(
                {
                    ...otherWinners[0].team,
                    wins: 0,
                    losses: 0,
                    points: 0
                },
                {
                    ...otherWinners[1].team,
                    wins: 0,
                    losses: 0,
                    points: 0
                }
            );


        /*
            WEEK 17
            CHAMPIONSHIP
        */

        const championship =
            simulateGame(
                {
                    ...semifinal1.winner,
                    wins: 0,
                    losses: 0,
                    points: 0
                },
                {
                    ...semifinal2.winner,
                    wins: 0,
                    losses: 0,
                    points: 0
                }
            );


        championshipCounts[
            championship.winner.rosterId
        ]++;

    }


    return {

        playoffCounts,

        championshipCounts

    };

}


/* ================================
   DISPLAY PLAYOFF PROBABILITIES
================================ */

function displayPlayoffProbabilities() {

    const container =
        document.getElementById(
            "playoff-probabilities"
        );


    if (!container) {
        return;
    }


    displayPlayoffBracket();


    const results =
        simulatePlayoffs();


    const rows =
        [...rosters].sort(
            (a, b) => {

                const winsA =
                    Number(
                        a.settings?.wins ||
                        0
                    );

                const winsB =
                    Number(
                        b.settings?.wins ||
                        0
                    );


                if (
                    winsB !==
                    winsA
                ) {

                    return (
                        winsB -
                        winsA
                    );

                }


                const pointsA =
                    Number(
                        a.settings?.fpts ||
                        0
                    );

                const pointsB =
                    Number(
                        b.settings?.fpts ||
                        0
                    );


                return (
                    pointsB -
                    pointsA
                );

            }
        );


    let html = `

        <h2>
            IF THE SEASON ENDED TODAY
        </h2>

        <div class="current-playoff-field">

    `;


    rows.forEach(
        (roster, index) => {

            const teamName =
                getTeamName(
                    roster.roster_id
                );


            const user =
                getUser(
                    roster.roster_id
                );


            const manager =
                getManagerUsername(
                    user
                );


            const clinched =
                hasClinchedPlayoffSpot(
                    roster
                );


            html += `

                <div
                    class="
                        playoff-field-team
                        ${index < playoffTeams
                            ? "playoff-team"
                            : "outside-playoff"}
                    "
                >

                    <span class="seed">
                        #${index + 1}
                    </span>

                    <span class="team-name">
                        ${teamName}
                    </span>

                    <span class="manager">
                        ${manager}
                    </span>

                    ${
                        index < playoffTeams
                            ? `
                                <span class="playoff-status">
                                    ${clinched ? "CLINCHED" : "IN"}
                                </span>
                              `
                            : `
                                <span class="playoff-status">
                                    OUT
                                </span>
                              `
                    }

                </div>

            `;

        }
    );


    html += `

        </div>

        <h2>
            PLAYOFF ODDS
        </h2>

        <div class="playoff-odds-grid">

    `;


    rows.forEach(
        roster => {

            const playoffCount =
                results.playoffCounts[
                    roster.roster_id
                ] || 0;


            const championshipCount =
                results.championshipCounts[
                    roster.roster_id
                ] || 0;


            let playoffPercentage =
                (
                    playoffCount /
                    simulations
                ) * 100;


            const championshipPercentage =
                (
                    championshipCount /
                    simulations
                ) * 100;


            if (
                hasClinchedPlayoffSpot(
                    roster
                )
            ) {

                playoffPercentage =
                    100;

            } else {

                playoffPercentage =
                    Math.min(
                        playoffPercentage,
                        99.9
                    );

            }


            html += `

                <div class="playoff-odds-card">

                    <div class="playoff-odds-team">
                        ${getTeamName(
                            roster.roster_id
                        )}
                    </div>

                    <div class="playoff-odds-manager">
                        ${getManagerUsername(
                            getUser(
                                roster.roster_id
                            )
                        )}
                    </div>

                    <div class="playoff-odds-row">

                        <span>
                            Playoff
                        </span>

                        <strong>
                            ${playoffPercentage.toFixed(1)}%
                        </strong>

                    </div>

                    <div class="playoff-odds-row">

                        <span>
                            Championship
                        </span>

                        <strong>
                            ${championshipPercentage.toFixed(1)}%
                        </strong>

                    </div>

                </div>

            `;

        }
    );


    html += `

        </div>

    `;


    container.innerHTML =
        html;

}


/* ================================
   DISPLAY PLAYOFF BRACKET
================================ */

function displayPlayoffBracket() {

    const container =
        document.getElementById(
            "playoff-bracket"
        );


    if (!container) {
        return;
    }


    const sortedRosters =
        [...rosters].sort(
            (a, b) => {

                const winsA =
                    Number(
                        a.settings?.wins ||
                        0
                    );

                const winsB =
                    Number(
                        b.settings?.wins ||
                        0
                    );


                if (
                    winsB !==
                    winsA
                ) {

                    return (
                        winsB -
                        winsA
                    );

                }


                const pointsA =
                    Number(
                        a.settings?.fpts ||
                        0
                    );

                const pointsB =
                    Number(
                        b.settings?.fpts ||
                        0
                    );


                return (
                    pointsB -
                    pointsA
                );

            }
        );


    const playoffRosters =
        sortedRosters.slice(
            0,
            playoffTeams
        );


    if (
        playoffRosters.length <
        playoffTeams
    ) {

        container.innerHTML = "";

        return;

    }


    const seed1 =
        playoffRosters[0];

    const seed2 =
        playoffRosters[1];

    const seed3 =
        playoffRosters[2];

    const seed4 =
        playoffRosters[3];

    const seed5 =
        playoffRosters[4];

    const seed6 =
        playoffRosters[5];

    const seed7 =
        playoffRosters[6];


    container.innerHTML = `

        <h2>
            PLAYOFF BRACKET
        </h2>

        <div class="bracket-round">

            <h3>
                WEEK ${playoffStartWeek}
            </h3>

            <div class="bracket-game">

                <span>
                    #${2}
                    ${getTeamName(
                        seed2.roster_id
                    )}
                </span>

                <strong>
                    VS
                </strong>

                <span>
                    #${7}
                    ${getTeamName(
                        seed7.roster_id
                    )}
                </span>

            </div>


            <div class="bracket-game">

                <span>
                    #${3}
                    ${getTeamName(
                        seed3.roster_id
                    )}
                </span>

                <strong>
                    VS
                </strong>

                <span>
                    #${6}
                    ${getTeamName(
                        seed6.roster_id
                    )}
                </span>

            </div>


            <div class="bracket-game">

                <span>
                    #${4}
                    ${getTeamName(
                        seed4.roster_id
                    )}
                </span>

                <strong>
                    VS
                </strong>

                <span>
                    #${5}
                    ${getTeamName(
                        seed5.roster_id
                    )}
                </span>

            </div>


            <div class="bracket-bye">

                #1
                ${getTeamName(
                    seed1.roster_id
                )}
                receives a first-round bye.

            </div>

        </div>

    `;

}


/* ================================
   DISPLAY LEAGUE LEADERS
================================ */

function displayLeagueLeaders() {

    const container =
        document.getElementById(
            "league-leaders"
        );


    if (!container) {
        return;
    }


    if (
        rosters.length ===
        0
    ) {

        container.innerHTML =
            "";

        return;

    }


    const highestScoring =
        [...rosters].sort(
            (a, b) =>
                Number(
                    b.settings?.fpts ||
                    0
                ) -
                Number(
                    a.settings?.fpts ||
                    0
                )
        )[0];


    const lowestPointsAgainst =
        [...rosters].sort(
            (a, b) =>
                Number(
                    a.settings?.fpts_against ||
                    0
                ) -
                Number(
                    b.settings?.fpts_against ||
                    0
                )
        )[0];


    const highestPointsAgainst =
        [...rosters].sort(
            (a, b) =>
                Number(
                    b.settings?.fpts_against ||
                    0
                ) -
                Number(
                    a.settings?.fpts_against ||
                    0
                )
        )[0];


    container.innerHTML = `

        <div class="leader-card">

            <div class="leader-title">
                UNSTOPPABLE FORCE
            </div>

            <div class="leader-team">
                ${getTeamName(
                    highestScoring.roster_id
                )}
            </div>

            <div class="leader-stat">
                ${Number(
                    highestScoring.settings?.fpts ||
                    0
                ).toFixed(2)}
                points
            </div>

        </div>


        <div class="leader-card">

            <div class="leader-title">
                DEFENSE WINS CHAMPIONSHIPS
            </div>

            <div class="leader-team">
                ${getTeamName(
                    lowestPointsAgainst.roster_id
                )}
            </div>

            <div class="leader-stat">
                ${Number(
                    lowestPointsAgainst.settings?.fpts_against ||
                    0
                ).toFixed(2)}
                PA
            </div>

        </div>


        <div class="leader-card">

            <div class="leader-title">
                UNLUCKY DUCK
            </div>

            <div class="leader-team">
                ${getTeamName(
                    highestPointsAgainst.roster_id
                )}
            </div>

            <div class="leader-stat">
                ${Number(
                    highestPointsAgainst.settings?.fpts_against ||
                    0
                ).toFixed(2)}
                PA
            </div>

        </div>

    `;

}


/* ================================
   DISPLAY WELCOME MESSAGE
================================ */

function displayWelcomeMessage() {

    const container =
        document.getElementById(
            "welcome-message"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <h1>
            Welcome to Papa's Liver GoFundMe
        </h1>

        <p>
            The Premier Fantasy Football League
        </p>

        <p>
            2026 Season • 12 Teams • 1 Trophy
        </p>

    `;

}


/* ================================
   LOAD LEAGUE
================================ */

async function loadLeague() {

    try {

        await updateCurrentNFLState();

        await loadHeadToHeadRecords();


        const leagueResponse =
            await fetch(
                `https://api.sleeper.app/v1/league/${leagueId}`
            );


        if (!leagueResponse.ok) {
            throw new Error(
                "Could not load league."
            );
        }


        league =
            await leagueResponse.json();


        const usersResponse =
            await fetch(
                `https://api.sleeper.app/v1/league/${leagueId}/users`
            );


        if (!usersResponse.ok) {
            throw new Error(
                "Could not load users."
            );
        }


        users =
            await usersResponse.json();


        const rostersResponse =
            await fetch(
                `https://api.sleeper.app/v1/league/${leagueId}/rosters`
            );


        if (!rostersResponse.ok) {
            throw new Error(
                "Could not load rosters."
            );
        }


        rosters =
            await rostersResponse.json();


        const matchupsResponse =
            await fetch(
                `https://api.sleeper.app/v1/league/${leagueId}/matchups/${currentWeek}`
            );


        if (
            matchupsResponse.ok
        ) {

            matchups =
                await matchupsResponse.json();

        } else {

            matchups = [];

        }


        const projectionResponse =
            await fetch(
                `https://api.sleeper.app//projections/nfl/${currentSeason}/${currentWeek}?season_type=regular`
            );


        if (
            projectionResponse.ok
        ) {

            projections =
                await projectionResponse.json();

        } else {

            projections = [];

        }


        remainingMatchups =
            {};


        for (
            let week =
                currentWeek + 1;

            week <=
            regularSeasonEndWeek;

            week++
        ) {

            const response =
                await fetch(
                    `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`
                );


            if (
                response.ok
            ) {

                remainingMatchups[
                    week
                ] =
                    await response.json();

            } else {

                remainingMatchups[
                    week
                ] = [];

            }

        }


        displayWelcomeMessage();

        displayMatchups();

        await displayStandings();

        displayPlayoffProbabilities();

        displayHistory();

        displayLeagueLeaders();


        console.log(
            "League loaded successfully."
        );


    } catch (error) {

        console.error(
            "Error loading league:",
            error
        );

    }

}


/* ================================
   AUTOMATIC REFRESH
================================ */

loadLeague();


setInterval(
    () => {

        loadLeague();

    },
    60000
);