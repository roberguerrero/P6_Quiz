const Sequelize = require("sequelize");
const {models} = require("../models");

// Autoload the quiz with id equals to :quizId
exports.load = (req, res, next, quizId) => {

    models.quiz.findById(quizId)
    .then(quiz => {
        if (quiz) {
            req.quiz = quiz;        // En req.quiz me dan el quiz correspondiente al id de la URL
                                    // Le podia haber llamado req.LOQUEYOQUIERA
            next();
        } else {
            throw new Error('There is no quiz with id=' + quizId);
        }
    })
    .catch(error => next(error));
};


// GET /quizzes
exports.index = (req, res, next) => {

    models.quiz.findAll()
    .then(quizzes => {
        res.render('quizzes/index.ejs', {quizzes});
    })
    .catch(error => next(error));
};


// GET /quizzes/:quizId
exports.show = (req, res, next) => {

    const {quiz} = req;

    res.render('quizzes/show', {quiz});
};


// GET /quizzes/new
exports.new = (req, res, next) => {

    const quiz = {
        question: "", 
        answer: ""
    };

    res.render('quizzes/new', {quiz});
};

// POST /quizzes/create
exports.create = (req, res, next) => {

    const {question, answer} = req.body;

    const quiz = models.quiz.build({
        question,
        answer
    });

    // Saves only the fields question and answer into the DDBB
    quiz.save({fields: ["question", "answer"]})
    .then(quiz => {
        req.flash('success', 'Quiz created successfully.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('quizzes/new', {quiz});
    })
    .catch(error => {
        req.flash('error', 'Error creating a new Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = (req, res, next) => {

    const {quiz} = req;

    res.render('quizzes/edit', {quiz});
};


// PUT /quizzes/:quizId
exports.update = (req, res, next) => {

    const {quiz, body} = req;

    quiz.question = body.question;
    quiz.answer = body.answer;

    quiz.save({fields: ["question", "answer"]})
    .then(quiz => {
        req.flash('success', 'Quiz edited successfully.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.render('quizzes/edit', {quiz});
    })
    .catch(error => {
        req.flash('error', 'Error editing the Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = (req, res, next) => {

    req.quiz.destroy()
    .then(() => {
        req.flash('success', 'Quiz deleted successfully.');
        res.redirect('/quizzes');
    })
    .catch(error => {
        req.flash('error', 'Error deleting the Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = (req, res, next) => {

    const {quiz, query} = req;

    const answer = query.answer || '';

    res.render('quizzes/play', {
        quiz,
        answer
    });
};


// GET /quizzes/:quizId/check
exports.check = (req, res, next) => {

    const {quiz, query} = req;

    const answer = query.answer || "";
    const result = answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz,
        result,
        answer
    });
};


//
// GET /quizzes/randomplay
//
// Viene aqui cuando le doy al botón Play
// Renderiza un quiz, que no ha sido contestado, de forma aleatoria
exports.randomplay = (req, res, next) => {

    // Almaceno los id de las preguntas contestadas
    // Si hay algo ya dentro, cojo eso y si no, cojo un array vacio
    req.session.randomPlay = req.session.randomPlay || [];


    // Condición: id distinto de los que hay en el array randomPlay, es decir, que no sea el id de las preguntas contestadas
    const Op = Sequelize.Op;
    const cond = {'id': {[Op.notIn]: req.session.randomPlay}}; //Esto es una opción, una condicion

    models.quiz.count({where: cond})  // Cuenta todas las que no he contestado, es decir, las que el id no esté en el array

    // Función para devolver un quiz aleatorio sabiendo el numero de quizzes que me quedan por responder
        .then(function (count) {
            return models.quiz.findAll({    // Busca todos los quizzes y me devuelve 1 aleatorio que su id no coincida con el de los respondidos
                where: cond,    // Las que no he contestado
                offset: Math.floor(Math.random() * count),    // 0 o 1 * numero = un valor de 0 a numero
                limit: 1    // Devuelve un quiz solo, no un array de quizzes con findAll de todos
            })


                .then(function (quizzes) {   // El array quizzes solo tiene 1 quiz que es el que he cogido de forma aleatorio
                    return quizzes[0];  // Solo tiene un quiz que esta en la posicion 0
                });
        })
        // Una vez que tengo el quiz aleatorio, lo renderizo
        .then(function (quiz) {
            const Myscore = req.session.randomPlay.length;

            // Compruebo si me quedan quizzes, si no me quedan el quiz devuelto es undefined
            if(quiz) {
                res.render('quizzes/random_play', {  // Le paso los parametros que necesito: el quiz y la puntuacion
                    quiz: quiz,
                    score: req.session.randomPlay.length // Nº de preguntas contestadas = puntos
                });
            }
            else {
                delete req.session.randomPlay;
                res.render('quizzes/random_nomore', {  // Cuando ya no tengo mas quizzes
                    score: Myscore // Nº de preguntas contestadas = puntos
                });

            }
        })
        .catch(error => next(error));


};

//
// GET /quizzes/randomcheck/:quizId(\\d+)
//
// Renderiza la pagina que me dice si he acertado o no

exports.randomcheck = (req, res, next) => {

    req.session.randomPlay = req.session.randomPlay || [];  // lo cambio por lo que el ya tiene
    const answer =  req.query.answer || "";    // el answer de query.answer es el name que he puesto en el input de random_play. Si no me pasan nada
    var score = req.session.randomPlay.length; // las que llevo acertadas hasta ese punto
    var resultado = true; // Inicializo
    const trueAnswer = req.quiz.answer;     // Respuesta correcta del quiz sacada de la base de datos


    if(answer.toLowerCase().trim() === trueAnswer.toLowerCase().trim()) {
        if(req.session.randomPlay.indexOf(req.quiz.id) === -1) {    // IndexOfe devuelve -1 cuando el id no está en el array,
                                                                    // luego una vez que lo haciento, ese id me devuelve -1 porque si está dentro
            resultado = true;
            req.session.randomPlay.push(req.quiz.id) // Meto el id del quiz acertado en el array de acertadas
            score = req.session.randomPlay.length;
        }
    }
    else {
        resultado = false;
        delete req.session.randomPlay; // A req.session le quito esa propiedad, me lo cargo
    }

    res.render('quizzes/random_result', {   // Le paso 3 parámetros: score, answer y result
        score: score,   // Es lo mismo que poner solo 'score,'
        answer: answer, // La respuesta que yo escribo
        result: resultado
    });

};