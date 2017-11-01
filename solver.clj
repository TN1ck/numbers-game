;; the initial game board
(def start [1 2 3 4 5 6 7 8 9 1 1 1 2 1 3 1 4 1 5 1 6 1 7 1 8 1 9])

(def filter-not-nil (partial filter (comp not nil?)))

;; two values match if they are the same or add up to 10
(defn match? [v1 v2]
  (and v1 v2 (or (= v1 v2) (= 10 (+ v1 v2)))))

;; 
(defn find-match [tiles i1 incr]
  (let [t1 (tiles i1)]
    (loop [i2 (+ incr i1)]
      (let [t2 (nth tiles i2 true)]
        (if (true? t2)
          nil
          (if (nil? t2)
              (recur (+ incr i2))
              (if (match? t1 t2)
                (if (neg? incr) [i2 i1] [i1 i2])
                nil)))))))

(defn find-matches [tiles i]
  (if (not (tiles i))
    nil
    (let [above (find-match tiles i -9)
          below (find-match tiles i 9)
          right (find-match tiles i 1)
          left (find-match tiles i -1)]
      (filter-not-nil [above below right left]))))

(defn remaining-matches [tiles]
  (into #{} (mapcat #(find-matches tiles %) (range (count tiles)))))

(defn remove-tiles [tiles i1 i2]
  (assoc tiles i1 nil i2 nil))

(defn update-board [tiles]
  (let [matches (remaining-matches tiles)]
    (if (empty? matches)
        (into [] (concat tiles (filter (comp not nil?) tiles)))
        tiles)))

;; I knew that 74 was a solution, so I tried to lower the amount everytime a solution was created
;; (def current-known-minimum-amount 74)
(def current-known-minimum-amount 74)

(defn solve []
  (loop [queue (sorted-set-by (fn [[a1 a2 a3 a4] [b1 b2 b3 b4]] (compare [a2 a3] [b2 b3]))
                              [(count start) 0 start []])
         counter 0
         solutions []]
    (let [current (first queue)
          [
          active_tiles steps tiles history] current
          matches (remaining-matches tiles)
          new-boards (pmap (fn [[i1 i2]]
                             (let [board (update-board (remove-tiles tiles i1 i2))
                                   count-active (count (filter-not-nil board))]
                               (vector count-active
                                       (inc steps)
                                       board
                                       (conj history [i1 i2]))))
                         matches)
          updated-boards (filter #(> current-known-minimum-amount (count (% 2))) new-boards)
          winner-boards (filter #(zero? (first %)) updated-boards)
          solutions (doall (concat solutions winner-boards))
          queue (disj (if (empty? updated-boards) queue  (apply (partial conj queue) updated-boards)) current)
        ]
        (if (zero? (count queue)) solutions (recur queue (inc counter) solutions)))))


(defn -main []
  (println (solve)))

;; simple function to simulate a solution
(defn play [steps board]
  (loop [S steps B board]
    (let [[i1 i2] (first S)
          bla (println i1 i2 B)
          new-board (update-board (remove-tiles B i1 i2))]
      (if (empty? (rest S)) new-board (recur (rest S) new-board)))))

(-main)