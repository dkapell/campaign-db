/* global CodeMirror capitalize marked*/
'use strict';
function renderMarkdownEditor(id, size, showPreview, previewUrl){
    const $textarea = $('#' + id);
    $textarea.height(size);

    if (showPreview){
        $(`#${id}-edit-tabs a[data-bs-toggle="tab"]`).on('shown.bs.tab', async function(e) {
            if ($(e.target).attr('aria-controls') === `${id}-preview`){
                if (previewUrl){
                    $(`#${id}-preview-frame`).html(await getPreview(previewUrl, $textarea.val()) );
                    $(`#${id}-preview-frame`).find('a').css('cursor', 'not-allowed').on('click', function(e){
                        e.preventDefault();
                    });
                } else {
                    $(`#${id}-preview-frame`).html(marked.parse($textarea.val(), {breaks: true}) );
                }
                const height = $textarea.height();
                $(`#${id}-preview-frame`).height(height);
            }
        });
    }
}


function renderEditor(id, type, size){
    const editorConfig = {
        lineNumbers: true,
        lineWrapping:true,
        autoRefresh:true,
    };
    const $textarea = $('#' + id);
    let showMarkdown = false;
    switch(type){
        case 'html-md':
            showMarkdown=true;
            editorConfig.mode = 'htmlmixed';
            break;
        case 'html':
            editorConfig.mode = 'htmlmixed';
            break;
        case 'json':
            editorConfig.mode = { name: 'javascript', json: true };
            break;
        case 'css':
            editorConfig.mode = 'css';
            break;
    }

    let editor = null;

    editor = CodeMirror.fromTextArea($textarea[0], editorConfig);
    $textarea.data('editor', editor);
    editor.setSize(null, size);
    if (type === 'html'){
        $('#' + id + '-edit-tabs a[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
            if ($(e.target).attr('aria-controls') === id + '-preview'){
                if (type === 'html'){
                    $('#' + id + '-preview-frame').html($.parseHTML(editor.getValue()));
                }
            }
        });
    } else if (type === 'html-md'){
        $('#' + id + '-edit-tabs a[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
            if ($(e.target).attr('aria-controls') === id + '-preview'){
                if (type === 'html-md'){
                    $('#' + id + '-preview-frame').html($.parseHTML(marked.parse(editor.getValue(), {breaks:true} )));
                }
            }
        });
    } else if (type === 'json'){
        editor.on('change', function(editor){
            try{
                const content = editor.getValue();
                if (content){
                    JSON.parse(editor.getValue());
                }
                editor.getTextArea().setCustomValidity('');
                $(editor.getWrapperElement()).removeClass('is-invalid');
                $(editor.getWrapperElement()).removeClass('border-danger');
                $(editor.getWrapperElement()).addClass('is-valid');
                $(editor.getWrapperElement()).addClass('border-success');
            } catch(e){
                editor.getTextArea().setCustomValidity('Not valid JSON');
                $(editor.getWrapperElement()).addClass('is-invalid');
                $(editor.getWrapperElement()).addClass('border-danger');
                $(editor.getWrapperElement()).removeClass('is-valid');
                $(editor.getWrapperElement()).removeClass('border-success');
            }
        });
    }
    editor.refresh();
    return editor;
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
