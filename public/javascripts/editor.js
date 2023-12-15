/* global CodeMirror capitalize marked*/
'use strict';
function renderMarkdownEditor(id, size, showPreview, previewUrl){
    const $textarea = $('#' + id);
    $textarea.height(size);

    if (showPreview){
        $(`#${id}-edit-tabs a[data-toggle="tab"]`).on('shown.bs.tab', async function(e) {
            if ($(e.target).attr('aria-controls') === `${id}-preview`){
                if (previewUrl){
                    $(`#${id}-preview-frame`).html(await getPreview(previewUrl, $textarea.val()) );
                    $(`#${id}-preview-frame`).find('a').css('cursor', 'not-allowed').on('click', function(e){
                        e.preventDefault();
                    });
                } else {
                    $(`#${id}-preview-frame`).html(marked($textarea.val(), {breaks: true}) );
                }
                const height = $textarea.height();
                $(`#${id}-preview-frame`).height(height);
            }
        });
    }
}


async function getPreview(url, content){
    const result = await fetch(url, {
        method:'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({content: content})
    });
    const data = await result.json();
    if (!data.success){
        console.error(data.error);
        return;
    }
    return data.content;
}
