const Sequelize = require("sequelize");
const {models} = require("../models");


// Autoload the tip with id equals to :tipId
exports.load = (req, res, next, tipId) => {

    models.tip.findById(tipId)
    .then(tip => {
        if (tip) {
            req.tip = tip;
            next();
        } else {
            next(new Error('There is no tip with tipId=' + tipId));
        }
    })
    .catch(error => next(error));
};


// MW that allows actions only if the user logged in is admin or is the author of the tip.
exports.adminOrAuthorRequired = (req, res, next) => {

    const isAdmin  = !!req.session.user.isAdmin; // El not not podría sobrar. Me sirve si isAdmin no es booleano, entonces el primer ! lo convertiria a booleano y el segundo lo cancela pero se queda en booleano
    const isAuthor = req.tip.authorId === req.session.user.id;

    if (isAdmin || isAuthor) {
        next(); // Si se cumple, paso al siguiente middleware
    } else {
        console.log('Prohibited operation: The logged in user is not the author of the tip, nor an administrator.');
        res.send(403);
    }
};



// POST /quizzes/:quizId/tips
exports.create = (req, res, next) => {

    const authorId = req.session.user && req.session.user.id || 0; // Saco al autor
    const tip = models.tip.build(
        {
            text: req.body.text,
            quizId: req.quiz.id,
            authorId //Añado quien crea la pista

        });

    tip.save()
    .then(tip => {
        req.flash('success', 'Tip created successfully.');
        res.redirect("back");
    })
    .catch(Sequelize.ValidationError, error => {
        req.flash('error', 'There are errors in the form:');
        error.errors.forEach(({message}) => req.flash('error', message));
        res.redirect("back");
    })
    .catch(error => {
        req.flash('error', 'Error creating the new tip: ' + error.message);
        next(error);
    });
};

// Editar un tip
// GET /quizzes/:quizId/tips/:tipId/edit
exports.edit = (req, res, next) => {

    const {tip, quiz} = req; // Lo saco del request, porque esta en la URL
    res.render('tips/edit', {tip, quiz}); //Le paso esos dos parametros


    // Otra forma de escribirlo es:
    /*
    const tip = req.tip;    // Coge el tip de request y me lo asignas a la variable tip
    const quiz = req.quiz;      //las dos son lo mismo que: const {tip, quiz} = req;

    req.render('tip/edit', {tip:tip, quiz:quiz});  // que es lo mismo que req.render('tip/edit', {tip, quiz});
    */

};

// Actualizar un tip
// PUT /quizzes/:quizId/tips/:tipId
exports.update = (req, res, next) => {

    const {quiz, tip, body} = req;       //En body estan todas las variables del formulario, hay un text que es lo que he escrito
                                            // el name="text" por lo que es body.text
    tip.text = body.text;

    tip.accepted = false;   // Cuando lo edito, tiene que volver a aceptarse

    tip.save({fields: ["text", "accepted"]})
        .then(tip => { //El tip que he guardado
            req.flash('success', 'Tip edited successfully.');
                // Flash: para guardar un texto y poder mostrarlo en el futuro
                // Se guardan en req.session
                // Como estoy haciendo un redirect, ese mensaje se perdería porque es de una petición anterior y estoy cambiando de pagina.
                // De esta manera tengo el mensaje accesible aun cambiando de pagina. Se guardan hasta la seguiente pagina que voy a mostrar, hasta que renderice la siguiente pagina.

            res.redirect('/goback/');    // Con goback redirige a la ultima pagina principal visitada
        })
        .catch(Sequelize.ValidationError, error => {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));
            res.render('tips/edit', {tip, quiz}); // Para rellenarlo bien cuando ha habido un fallo
        })
        .catch(error => {
            req.flash('error', 'Error editing the tip: ' + error.message);
            next(error);
        });
};







// GET /quizzes/:quizId/tips/:tipId/accept
exports.accept = (req, res, next) => {

    const {tip} = req;

    tip.accepted = true;

    tip.save(["accepted"])
    .then(tip => {
        req.flash('success', 'Tip accepted successfully.');
        res.redirect('/quizzes/' + req.params.quizId);
    })
    .catch(error => {
        req.flash('error', 'Error accepting the tip: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId/tips/:tipId
exports.destroy = (req, res, next) => {

    req.tip.destroy()
    .then(() => {
        req.flash('success', 'tip deleted successfully.');
        res.redirect('/quizzes/' + req.params.quizId);
    })
    .catch(error => next(error));
};

