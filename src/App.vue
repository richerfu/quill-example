<template>
  <div id="quill" ref="quillEditor"/>
</template>

<script setup lang="ts">
import {onMounted, ref,nextTick} from "vue";
import Quill from "quill";
import {Delta, Loro, LoroText} from "loro-crdt";
import { io, Socket } from 'socket.io-client';
import {assertEqual} from "./diff";

const Delta = Quill.import('delta')

const quillEditor = ref();
const quill = ref<Quill>();
const richtext = ref<LoroText>();
const loro = ref<Loro>();
const socket = ref<Socket>();

onMounted(() => {
  if (!socket.value) {
    socket.value = io("ws://localhost:3000");
  }

  quill.value = new Quill(quillEditor.value, {
    modules: {
      toolbar: [
        [{header: [1, 2, false]}],
        ['bold', 'italic', 'underline'],
        ['image', 'code-block'],
      ],
    },
    placeholder: 'Compose an epic...',
    theme: 'snow', // or 'bubble'
  });

  quill.value.on('text-change', (data, oldData, source) => {
    nextTick(() => {
      if (data && data.ops) {
        // update content
        const ops = data.ops;
        if (source !== ('this' as any)) {
          let index = 0;
          for (const op of ops) {
            if (op.retain != null) {
              let end = index + (op.retain as number);
              if (op.attributes) {
                if (index == richtext.value.length) {
                  richtext.value.insert(index, "\n");
                }
                for (const key of Object.keys(op.attributes)) {
                  let value = op.attributes[key];
                  if (value == null) {
                    richtext.value.unmark({start: index, end}, key);
                  } else {
                    richtext.value.mark({start: index, end}, key, value);
                  }
                }
              }
              index += op.retain as number;
            } else if (op.insert != null) {
              if (typeof op.insert == "string") {
                let end = index + op.insert.length;
                richtext.value.insert(index, op.insert);
                if (op.attributes) {
                  for (const key of Object.keys(op.attributes)) {
                    let value = op.attributes[key];
                    if (value == null) {
                      richtext.value.unmark({start: index, end}, key);
                    } else {
                      richtext.value.mark({start: index, end}, key, value);
                    }
                  }
                }
                index = end;
              } else {
                throw new Error("Not implemented");
              }
            } else if (op.delete != null) {
              richtext.value.delete(index, op.delete);
            } else {
              throw new Error("Unreachable");
            }
          }
          loro.value.commit();
          const a = richtext.value.toDelta();
          const b = quill.value.getContents().ops;
          if (!assertEqual(a, b as any)) {
            quill.value.setContents(new Delta(a), "this" as any);
          }
        }
      }
    })
  })

  loro.value = new Loro();
  richtext.value = loro.value.getText("text");

  richtext.value.subscribe((event) => {
    if (event.by !== 'local' && event.events[0]?.diff.type === 'text') {
      const eventDelta = event.events[0].diff.diff;
      const delta: Delta<string>[] = [];
      let index = 0;
      for (let i = 0; i < eventDelta.length; i++) {
        const d = eventDelta[i];
        const length = d.delete || d.retain || d.insert!.length;
        // skip the last newline that quill automatically appends
        if (
            d.insert &&
            d.insert === "\n" &&
            index === quill.value.getLength() - 1 &&
            i === eventDelta.length - 1 &&
            d.attributes != null &&
            Object.keys(d.attributes).length > 0
        ) {
          delta.push({
            retain: 1,
            attributes: d.attributes,
          });
          index += length;
          continue;
        }

        delta.push(d);
        index += length;
      }
      quill.value.updateContents(new Delta(delta), "this" as any);
      const a = richtext.value.toDelta();
      const b = quill.value.getContents().ops;
      if (!assertEqual(a, b as any)) {
        quill.value.setContents(new Delta(a), "this" as any);
      }
    }
  })

  loro.value.subscribe(event => {
    if (event.by === 'local') {
      const d = loro.value.exportFrom();
      socket.value.emit("update-snapshot", d);
      return;
    }
  })

  socket.value.on('update-snapshot', (snapshot) => {
    loro.value.import(new Uint8Array(snapshot));
  })
})
</script>