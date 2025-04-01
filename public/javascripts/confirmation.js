'use strict';
(function ( $ ) {
    $.fn.confirmation = function confirmation(options){

        const settings = $.extend(true, {
            dialog: '',
            title: 'Please confirm this action',
            message: 'Are you sure you want to perform this action?',
            showHeader: true,
            showMessage: false,
            animationClass: 'fade',
            confirmText: 'Confirm',
            cancelText: 'Cancel'
        }, options || {});

        const modalId = 'modal-confirm-2291ab47-2c70-4e26-af83-9e02d2b062e8';

        let modal = null;

        this.off('click.confirmation').on('click.confirmation', function(e){
            const copy = $.extend(true, {}, e);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            for (const field in settings){
                if ($(this).attr(field)){
                    settings[field] = $(this).attr(field);
                }
            }
            if ($(this).attr('data-bs-original-title')){
                settings.title = $(this).attr('data-bs-original-title');
            }
            $(this).tooltip('hide');
            buildModal();
            modal.modal('show');
            (async () => {
                const result = await runConfirm();
                if (result){
                    $(copy.currentTarget).off('click.confirmation').trigger(copy);
                }
                return result;
            })();
        });

        async function runConfirm() {
            return new Promise((resolve, reject) => {

                document.body.addEventListener('click', response);

                function response(e) {
                    let bool = false;
                    if (e.target.id == 'confirm-cancel') bool = false;
                    else if (e.target.id == 'confirm-accept') bool = true;
                    else return;

                    document.body.removeEventListener('click', response);

                    modal.modal('hide');
                    resolve(bool);
                }
            });

        }

        function buildModal() {
            let headerHtml = '';
            if (settings.showHeader) {
                headerHtml = `
                    <div class="modal-header p-2">
                        <h1 class="modal-title fs-5" id="exampleModalLabel">${settings.title}</h1>
                        <button type="button" class="btn-close  js-cancel" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>`;
            }

            const theme = $('html').attr('data-bs-theme');
            let textClass = '';
            if (theme === 'dark') {
                textClass = 'text-bg-light';
            }

            let messageHtml = '';
            if (settings.showMessage){
                messageHtml = `
                    <div class="modal-body p-2">
                        ${settings.message}
                    </div>`;
            }

            const modalDialog = `
                <div class="modal-dialog ${settings.dialog} modal-dialog-centered">
                    <div class="modal-content ${textClass}">
                        ${headerHtml}
                        ${messageHtml}
                        <div class="modal-footer p-2 border-top-0">
                            <button type="button" id="confirm-cancel" class="btn btn-sm btn-secondary js-cancel" data-bs-dismiss="modal">${settings.cancelText}</button>
                            <button type="button" id="confirm-accept" class="btn btn-sm btn-primary js-confirm">${settings.confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
            `;

            modal = $('<div>', {
                'data-bs-theme': theme,
                class: `modal ${settings.animationClass}`,
                id: modalId,
                'data-bs-backdrop': 'static',
                'data-bs-keyboard': false,
                'aria-hidden': true,
                html: modalDialog
            });

        }

        return this;

    };
}(jQuery));
